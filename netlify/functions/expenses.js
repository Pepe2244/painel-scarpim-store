// NOME DO ARQUIVO: netlify/functions/expenses.js
// Importa a biblioteca 'postgres' para ligar ao Neon
const postgres = require('postgres');

// Obtém a URL de ligação da base de dados das variáveis de ambiente do Netlify
const { NEON_DATABASE_URL } = process.env;

// O 'handler' é a função principal que o Netlify executará quando este endpoint for chamado
exports.handler = async (event) => {
    // Liga à base de dados
    const sql = postgres(NEON_DATABASE_URL, { ssl: 'require' });

    try {
        // --- LÓGICA PARA TRATAR DIFERENTES MÉTODOS HTTP ---

        // SE for um pedido GET (procurar dados)
        if (event.httpMethod === 'GET') {
            const expenses = await sql`SELECT * FROM expenses`;
            return {
                statusCode: 200,
                body: JSON.stringify(expenses),
            };
        }

        // SE for um pedido POST (adicionar nova despesa)
        if (event.httpMethod === 'POST') {
            const { description, value } = JSON.parse(event.body);
            if (!description || !value) {
                return { statusCode: 400, body: 'Descrição e valor são obrigatórios.' };
            }
            await sql`INSERT INTO expenses (description, value) VALUES (${description}, ${value})`;
            return { statusCode: 201 }; // 201 = Created
        }

        // SE for um pedido DELETE (remover despesa)
        if (event.httpMethod === 'DELETE') {
            const { id } = JSON.parse(event.body);
            if (!id) {
                return { statusCode: 400, body: 'ID da despesa é obrigatório.' };
            }
            await sql`DELETE FROM expenses WHERE id = ${id}`;
            return { statusCode: 200 };
        }

        // Se o método não for um dos esperados
        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Erro na função de despesas:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Falha ao processar o pedido.' }),
        };
    }
};

