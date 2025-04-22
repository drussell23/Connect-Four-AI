import fetch from 'node-fetch';  // or global fetch

export async function getAIMoveViaAPI(board2ch) {
  const res = await fetch('http://localhost:8000/predict', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ board: board2ch })
  });
  if (!res.ok) throw new Error('ML service error');
  const { move } = await res.json();
  return move;
}
