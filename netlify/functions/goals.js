// NOME DO ARQUIVO: netlify/functions/goals.js
const postgres = require('postgres');

const { NEON_DATABASE_URL } = process.env;

exports.handler = async (event) => {
    const sql = postgres(NEON_DATABASE_URL, { ssl: 'require' });

    try {
        // --- LÓGICA PARA PEDIDOS GET ---
        if (event.httpMethod === 'GET') {
            const goals = await sql`SELECT * FROM goals`;
            return {
                statusCode: 200,
                body: JSON.stringify(goals),
            };
        }

        // --- LÓGICA PARA PEDIDOS POST (CRIAR META) ---
        if (event.httpMethod === 'POST') {
            const { description, type, value } = JSON.parse(event.body);
            if (!description || !type || !value) {
                return { statusCode: 400, body: 'Todos os campos da meta são obrigatórios.' };
            }
            await sql`INSERT INTO goals (description, type, value) VALUES (${description}, ${type}, ${value})`;
            return { statusCode: 201 };
        }

        // --- LÓGICA PARA PEDIDOS DELETE (APAGAR META) ---
        if (event.httpMethod === 'DELETE') {
            const { id } = JSON.parse(event.body);
            if (!id) {
                return { statusCode: 400, body: 'O ID da meta é obrigatório.' };
            }
            await sql`DELETE FROM goals WHERE id = ${id}`;
            return { statusCode: 200 };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };

    } catch (error) {
        console.error('Erro na função de metas:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Falha ao processar o pedido de metas.' }),
        };
    }
};

