import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    const { name, score } = request.body;
    if (!name || typeof score !== 'number') {
      return response.status(400).json({ message: 'Invalid name or score' });
    }
    await sql`INSERT INTO scores (name, score) VALUES (${name}, ${score});`;
    return response.status(200).json({ message: 'Score submitted' });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
