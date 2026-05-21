import { parseMarkdown, generateMarkdown } from './parser.js';

console.log('--- Markdown Parser Verification Script ---');

const sampleMarkdown = `---
week: 21
start_date: 2026-05-18
biometrics:

---

# 2026-W21 | DELOAD WEEK | ЕДИНЫЙ ЛОГ

Состояние на начало недели:
- Вес: 75.5
- Сон: 7h 30m
- Настроение: Хорошее

---

## Пн (18.05) | Upper Power (Deload) | MODERATE CARB
1. Жим штанги лежа — 55.0 кг, 2 x 8, RPE =
   * Примечание: тяжело шло
2. Армейский жим — 30.0 кг, 2 x 8, RPE = 8
3. Сведения (тренажер) — 25.0 кг, 2 x 12, RPE =

---

## Вт (19.05) | Lower Quality (Deload) | HIGH CARB
1. Приседания — 65.0 кг, 3 x 8, RPE =
2. Сгибания ног — 30.0 кг, 2 x 12, RPE =
`;

try {
  // 1. Test Parsing
  console.log('1. Parsing sample Markdown...');
  const parsed = parseMarkdown(sampleMarkdown);
  console.log('Parsed result keys:', Object.keys(parsed));
  
  // Verifications
  if (parsed.week_number !== 21) throw new Error(`Expected week 21, got ${parsed.week_number}`);
  if (parsed.start_date !== '2026-05-18') throw new Error(`Expected start_date 2026-05-18, got ${parsed.start_date}`);
  if (parsed.title !== '2026-W21 | DELOAD WEEK | ЕДИНЫЙ ЛОГ') throw new Error(`Expected title matching, got "${parsed.title}"`);
  
  // Biometrics
  if (parsed.biometrics.weight !== '75.5') throw new Error(`Expected weight 75.5, got ${parsed.biometrics.weight}`);
  if (parsed.biometrics.sleep !== '7h 30m') throw new Error(`Expected sleep 7h 30m, got ${parsed.biometrics.sleep}`);
  if (parsed.biometrics.mood !== 'Хорошее') throw new Error(`Expected mood Хорошее, got ${parsed.biometrics.mood}`);
  
  // Days
  if (parsed.days_data.length !== 2) throw new Error(`Expected 2 days, got ${parsed.days_data.length}`);
  
  const monday = parsed.days_data[0];
  if (monday.day !== 'Пн') throw new Error(`Expected Monday (Пн), got ${monday.day}`);
  if (monday.date !== '18.05') throw new Error(`Expected date 18.05, got ${monday.date}`);
  if (monday.type !== 'Upper Power (Deload)') throw new Error(`Expected type Upper Power (Deload), got "${monday.type}"`);
  if (monday.diet !== 'MODERATE CARB') throw new Error(`Expected diet MODERATE CARB, got ${monday.diet}`);
  
  // Exercises
  if (monday.exercises.length !== 3) throw new Error(`Expected 3 exercises on Monday, got ${monday.exercises.length}`);
  
  const bench = monday.exercises[0];
  if (bench.name !== 'Жим штанги лежа') throw new Error(`Expected Жим штанги лежа, got "${bench.name}"`);
  if (bench.params !== '55.0 кг, 2 x 8') throw new Error(`Expected 55.0 кг, 2 x 8, got "${bench.params}"`);
  if (bench.rpe !== '') throw new Error(`Expected empty RPE, got "${bench.rpe}"`);
  if (bench.comment !== 'тяжело шло') throw new Error(`Expected comment "тяжело шло", got "${bench.comment}"`);
  
  const press = monday.exercises[1];
  if (press.rpe !== '8') throw new Error(`Expected RPE = 8, got "${press.rpe}"`);
  
  console.log('✅ Parsing successfully verified!');

  // 2. Test Modification & Regeneration
  console.log('2. Modifying parsed data...');
  // Set RPE for bench press
  bench.rpe = '7.5';
  // Add comment to press
  press.comment = 'Отличная скорость';
  // Update weight
  parsed.biometrics.weight = '75.0';

  console.log('3. Regenerating Markdown...');
  const regenerated = generateMarkdown(parsed);
  console.log('--- Regenerated Markdown Output ---');
  console.log(regenerated);
  console.log('-----------------------------------');

  // 4. Re-parsing regenerated MD to verify lossless round-trip
  console.log('4. Re-parsing regenerated Markdown...');
  const reParsed = parseMarkdown(regenerated);
  
  if (reParsed.biometrics.weight !== '75.0') throw new Error('Regenerated weight failed');
  
  const reBench = reParsed.days_data[0].exercises[0];
  if (reBench.rpe !== '7.5') throw new Error(`Regenerated RPE failed: expected 7.5, got "${reBench.rpe}"`);
  if (reBench.comment !== 'тяжело шло') throw new Error('Regenerated comment failed');
  
  const rePress = reParsed.days_data[0].exercises[1];
  if (rePress.comment !== 'Отличная скорость') throw new Error('Regenerated comment on press failed');
  
  console.log('✅ Round-trip parser/generator successfully verified!');
  console.log('\n⭐⭐⭐ ALL PARSER TESTS PASSED SUCCESSFULLY! ⭐⭐⭐');

} catch (error) {
  console.error('❌ Parser test failed:', error);
  process.exit(1);
}
