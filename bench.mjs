const MODEL = process.argv[2] || 'qwen2.5-coder:1.5b';

const body = {
  model: MODEL,
  prompt: 'Напиши функцию на JavaScript, которая считает факториал числа.',
  stream: false,
  keep_alive: '30m',
  options: { num_ctx: 4096 },
};

console.log(`Модель: ${MODEL}`);
console.time('  запрос');

const res = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const data = await res.json();
console.timeEnd('  запрос');

const sec = (ns) => (ns ? (ns / 1e9).toFixed(1) : '?');
const rate = (count, dur) =>
  count && dur ? (count / (dur / 1e9)).toFixed(1) : '?';

console.log('');
console.log('  load_duration:        ', sec(data.load_duration), 's');
console.log('  prompt_eval_count:    ', data.prompt_eval_count);
console.log('  prompt_eval_duration: ', sec(data.prompt_eval_duration), 's =',
            rate(data.prompt_eval_count, data.prompt_eval_duration), 'tok/s');
console.log('  eval_count:           ', data.eval_count);
console.log('  eval_duration:        ', sec(data.eval_duration), 's =',
            rate(data.eval_count, data.eval_duration), 'tok/s');
console.log('  total_duration:       ', sec(data.total_duration), 's');
console.log('');
console.log('  Ответ:', (data.response ?? '').slice(0, 200));