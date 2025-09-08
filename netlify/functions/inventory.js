// NOME DO ARQUIVO: netlify/functions/inventory.js
// Importa a biblioteca 'postgres' para ligar ao Neon
const postgres = require('postgres');

// Obtém a URL de ligação da base de dados das variáveis de ambiente do Netlify
const { NEON_DATABASE_URL } = process.env;

// O 'handler' é a função principal que o Netlify executará quando este endpoint for chamado
exports.handler = async (event) => {
    // Liga à base de dados com a configuração SSL explícita
    const sql = postgres(NEON_DATABASE_URL, { 
      ssl: { 
        rejectUnauthorized: false 
      } 
    });

    try {
        // --- LÓGICA PARA TRATAR DIFERENTES MÉTODOS HTTP ---

        // SE for um pedido GET (procurar dados)
        if (event.httpMethod === 'GET') {
            const inventory = await sql`SELECT * FROM inventory`;
            return {
                statusCode: 200,
                body: JSON.stringify(inventory),
            };
        }

        // SE for um pedido POST (adicionar novo produto)
        if (event.httpMethod === 'POST') {
            const { name, cost, quantity } = JSON.parse(event.body);
            await sql`INSERT INTO inventory (name, cost, quantity) VALUES (${name}, ${cost}, ${quantity})`;
            return { statusCode: 201 }; // 201 = Created
        }

        // SE for um pedido PUT (atualizar quantidade)
        if (event.httpMethod === 'PUT') {
            const { id, quantity } = JSON.parse(event.body);
            await sql`UPDATE inventory SET quantity = ${quantity} WHERE id = ${id}`;
            return { statusCode: 200 };
        }

        // SE for um pedido DELETE (remover produto)
        if (event.httpMethod === 'DELETE') {
            const { id } = JSON.parse(event.body);
            await sql`DELETE FROM inventory WHERE id = ${id}`;
            return { statusCode: 200 };
        }

        // Se o método não for um dos esperados
        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Erro na função de stock:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Falha ao processar o pedido.' }),
        };
    }
};