// NOME DO ARQUIVO: netlify/functions/orders.js
const postgres = require('postgres');

const { NEON_DATABASE_URL } = process.env;

exports.handler = async (event) => {
    const sql = postgres(NEON_DATABASE_URL, { ssl: 'require' });

    try {
        // --- LÓGICA PARA PEDIDOS GET ---
        if (event.httpMethod === 'GET') {
            const orders = await sql`SELECT * FROM orders`;
            return { statusCode: 200, body: JSON.stringify(orders) };
        }

        // --- LÓGICA PARA PEDIDOS POST (CRIAR PEDIDO) ---
        if (event.httpMethod === 'POST') {
            const { client_name, product_name, quantity, value } = JSON.parse(event.body);

            // Inicia uma transação para garantir a consistência dos dados
            await sql.begin(async sql => {
                // 1. Verifica o stock do produto
                const [product] = await sql`SELECT quantity FROM inventory WHERE name = ${product_name}`;

                if (!product || product.quantity < quantity) {
                    // Se não houver stock, lança um erro para cancelar a transação
                    throw new Error('Stock insuficiente.');
                }

                // 2. Se houver stock, atualiza a quantidade
                const newQuantity = product.quantity - quantity;
                await sql`UPDATE inventory SET quantity = ${newQuantity} WHERE name = ${product_name}`;

                // 3. Insere o novo pedido
                await sql`INSERT INTO orders (client_name, product_name, quantity, value) VALUES (${client_name}, ${product_name}, ${quantity}, ${value})`;
            });

            return { statusCode: 201 };
        }

        // --- LÓGICA PARA PEDIDOS PUT (ATUALIZAR STATUS) ---
        if (event.httpMethod === 'PUT') {
            const { id, status } = JSON.parse(event.body);
            await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
            return { statusCode: 200 };
        }

        // --- LÓGICA PARA PEDIDOS DELETE (APAGAR PEDIDO) ---
        if (event.httpMethod === 'DELETE') {
            const { id, product_name, quantity } = JSON.parse(event.body);

            // Usa uma transação para garantir que ambas as operações (apagar e devolver ao stock) funcionam
            await sql.begin(async sql => {
                // 1. Apaga o pedido
                await sql`DELETE FROM orders WHERE id = ${id}`;
                // 2. Devolve a quantidade ao stock
                await sql`UPDATE inventory SET quantity = quantity + ${quantity} WHERE name = ${product_name}`;
            });

            return { statusCode: 200 };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Erro na função de pedidos:', error);
        return {
            statusCode: 500,
            // Retorna a mensagem de erro específica para o front-end
            body: JSON.stringify({ message: error.message }),
        };
    }
};
