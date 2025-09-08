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
      const clients = await sql`SELECT * FROM clients`;
      return {
        statusCode: 200,
        body: JSON.stringify(clients),
      };
    }
    
    // SE for um pedido POST (adicionar novo cliente)
    if (event.httpMethod === 'POST') {
      const { name, number } = JSON.parse(event.body);
      // Validação simples
      if (!name || !number) {
        return { statusCode: 400, body: 'Nome e número são obrigatórios.' };
      }
      await sql`INSERT INTO clients (name, number) VALUES (${name}, ${number})`;
      return { statusCode: 201 }; // 201 = Created
    }

    // SE for um pedido DELETE (remover cliente)
    if (event.httpMethod === 'DELETE') {
        const { id } = JSON.parse(event.body);
        if (!id) {
            return { statusCode: 400, body: 'ID do cliente é obrigatório.'};
        }
        await sql`DELETE FROM clients WHERE id = ${id}`;
        return { statusCode: 200 };
    }

    // Se o método não for um dos esperados
    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (error) {
    console.error('Erro na função de clientes:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falha ao processar o pedido.' }),
    };
  }
};
