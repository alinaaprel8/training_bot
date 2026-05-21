import { 
  classifyExercise, 
  parseExerciseParams, 
  calculateDayMetrics, 
  calculateWeekMetrics, 
  generateTrendChartUrl, 
  parseWeight,
  formatDayAnalysis,
  formatWeekAnalysis
} from './analysis.js';

console.log('--- Workout Analysis Verification Script ---');

try {
  // 1. Test Muscle Group Classification
  console.log('1. Testing muscle group classification...');
  const tests = [
    { name: 'Жим штанги лежа', expected: 'Грудь' },
    { name: 'Жим гантелей лежа на наклонной скамье', expected: 'Грудь' },
    { name: 'Сведения в пек-деке', expected: 'Грудь' },
    { name: 'Отжимания на брусьях', expected: 'Грудь' },
    { name: 'Приседания со штангой на спине', expected: 'Ноги' },
    { name: 'Румынская тяга с гантелями', expected: 'Ноги' },
    { name: 'Становая тяга классика', expected: 'Ноги' },
    { name: 'Тяга верхнего блока', expected: 'Спина' },
    { name: 'Подтягивания широким хватом', expected: 'Спина' },
    { name: 'Гиперэкстензия', expected: 'Спина' },
    { name: 'Армейский жим стоя', expected: 'Плечи' },
    { name: 'Жим гантелей сидя', expected: 'Плечи' },
    { name: 'Разводка гантелей в стороны', expected: 'Плечи' },
    { name: 'Махи в стороны на блоке', expected: 'Плечи' },
    { name: 'Сгибания на бицепс', expected: 'Руки' },
    { name: 'Разгибания рук на блоке (трицепс)', expected: 'Руки' },
    { name: 'Французский жим лежа', expected: 'Руки' },
    { name: 'Молотки на бицепс', expected: 'Руки' },
    { name: 'Скручивания на пресс', expected: 'Кор' },
    { name: 'Планка статическая', expected: 'Кор' },
    { name: 'Подъем ног в висе', expected: 'Кор' },
    { name: 'Бег на беговой дорожке', expected: 'Другое' }
  ];

  tests.forEach(t => {
    const result = classifyExercise(t.name);
    if (result !== t.expected) {
      throw new Error(`Classification error for "${t.name}": expected ${t.expected}, got ${result}`);
    }
  });
  console.log('✅ Muscle group classification is 100% correct!');

  // 2. Test Parameter Parsing
  console.log('\n2. Testing exercise parameters parsing...');
  const paramTests = [
    { input: '55.0 кг, 2 x 8', weight: 55.0, sets: 2, reps: 8, tonnage: 880, isWeightBased: true },
    { input: '55,0 кг, 2 x 8', weight: 55.0, sets: 2, reps: 8, tonnage: 880, isWeightBased: true },
    { input: '12.5 kg, 3x12', weight: 12.5, sets: 3, reps: 12, tonnage: 450, isWeightBased: true },
    { input: '10, 3 x 15', weight: 10, sets: 3, reps: 15, tonnage: 450, isWeightBased: true },
    { input: '80кг x 3 x 8', weight: 80, sets: 3, reps: 8, tonnage: 1920, isWeightBased: true },
    { input: '3 x 12 (собственный вес)', weight: 0, sets: 3, reps: 12, tonnage: 0, isWeightBased: false },
    { input: '3 x 15 св', weight: 0, sets: 3, reps: 15, tonnage: 0, isWeightBased: false },
    { input: '3 x 30 сек', weight: 0, sets: 3, reps: 30, tonnage: 0, isWeightBased: false }
  ];

  paramTests.forEach(t => {
    const res = parseExerciseParams(t.input);
    if (res.weight !== t.weight) throw new Error(`Weight error on "${t.input}": expected ${t.weight}, got ${res.weight}`);
    if (res.sets !== t.sets) throw new Error(`Sets error on "${t.input}": expected ${t.sets}, got ${res.sets}`);
    if (res.reps !== t.reps) throw new Error(`Reps error on "${t.input}": expected ${t.reps}, got ${res.reps}`);
    if (res.tonnage !== t.tonnage) throw new Error(`Tonnage error on "${t.input}": expected ${t.tonnage}, got ${res.tonnage}`);
    if (res.isWeightBased !== t.isWeightBased) throw new Error(`isWeightBased error on "${t.input}": expected ${t.isWeightBased}, got ${res.isWeightBased}`);
  });
  console.log('✅ Parameter parsing works beautifully!');

  // 3. Test Weight Extraction
  console.log('\n3. Testing weight string extraction...');
  const weightTests = [
    { input: '82.5', expected: 82.5 },
    { input: '82.5 кг', expected: 82.5 },
    { input: '79,2kg', expected: 79.2 },
    { input: 'нет данных', expected: null },
    { input: '', expected: null }
  ];

  weightTests.forEach(t => {
    const res = parseWeight(t.input);
    if (res !== t.expected) {
      throw new Error(`Weight extraction error for "${t.input}": expected ${t.expected}, got ${res}`);
    }
  });
  console.log('✅ Weight string extraction works flawlessly!');

  // 4. Test Day Metrics Calculations
  console.log('\n4. Testing day metrics calculations...');
  const sampleDay = {
    day: 'Пн',
    date: '18.05',
    type: 'Upper Power (Deload)',
    diet: 'MODERATE CARB',
    exercises: [
      { id: 1, name: 'Жим штанги лежа', params: '55.0 кг, 2 x 8', rpe: '8', comment: '' }, // Chest: 55 * 2 * 8 = 880 kg, 2 sets
      { id: 2, name: 'Армейский жим', params: '30.0 кг, 2 x 8', rpe: '8.5', comment: '' }, // Shoulders: 30 * 2 * 8 = 480 kg, 2 sets
      { id: 3, name: 'Сведения (тренажер)', params: '25.0 кг, 2 x 12', rpe: '8', comment: '' }, // Chest: 25 * 2 * 12 = 600 kg, 2 sets
      { id: 4, name: 'Подтягивания широким хватом', params: '3 x 10 (собственный вес)', rpe: '', comment: '' } // Back: 0 kg, 3 sets
    ]
  };

  const dayMetrics = calculateDayMetrics(sampleDay);
  
  // Total Tonnage = 880 + 480 + 600 = 1960
  if (dayMetrics.totalTonnage !== 1960) throw new Error(`Day tonnage error: expected 1960, got ${dayMetrics.totalTonnage}`);
  // Total Sets = 2 + 2 + 2 + 3 = 9
  if (dayMetrics.totalSets !== 9) throw new Error(`Day sets error: expected 9, got ${dayMetrics.totalSets}`);
  // Avg RPE: (8 + 8.5 + 8) / 3 = 8.1666...
  const expectedRpe = 8.17;
  const roundedRpe = parseFloat(dayMetrics.avgRpe.toFixed(2));
  if (roundedRpe !== expectedRpe) throw new Error(`Day avg RPE error: expected ${expectedRpe}, got ${roundedRpe}`);

  // Muscle Groups Breakdowns
  if (dayMetrics.muscleGroups['Грудь'].tonnage !== 1480) throw new Error(`Chest tonnage error: expected 1480, got ${dayMetrics.muscleGroups['Грудь'].tonnage}`);
  if (dayMetrics.muscleGroups['Грудь'].sets !== 4) throw new Error(`Chest sets error: expected 4, got ${dayMetrics.muscleGroups['Грудь'].sets}`);
  if (dayMetrics.muscleGroups['Спина'].tonnage !== 0) throw new Error(`Back tonnage error: expected 0, got ${dayMetrics.muscleGroups['Спина'].tonnage}`);
  if (dayMetrics.muscleGroups['Спина'].sets !== 3) throw new Error(`Back sets error: expected 3, got ${dayMetrics.muscleGroups['Спина'].sets}`);

  console.log('✅ Day metrics are calculated perfectly!');

  // 5. Test Text Analysis Layout Formatting
  console.log('\n5. Testing formatted output layouts...');
  const formattedDay = formatDayAnalysis(sampleDay);
  console.log('--- Formatted Day Analysis Output ---');
  console.log(formattedDay);
  console.log('-------------------------------------');

  const sampleWorkout = {
    week_number: 21,
    title: 'DELOAD WEEK',
    biometrics: { weight: '75.5', sleep: '7h', mood: 'Good' },
    days_data: [sampleDay]
  };

  const formattedWeek = formatWeekAnalysis(sampleWorkout);
  console.log('--- Formatted Week Analysis Output ---');
  console.log(formattedWeek);
  console.log('--------------------------------------');
  
  // 6. Test QuickChart URL Generation
  console.log('\n6. Testing QuickChart URL generation...');
  const workoutsHistory = [
    {
      week_number: 20,
      biometrics: { weight: '76.2' },
      days_data: [
        {
          day: 'Пн',
          exercises: [{ id: 1, name: 'Жим штанги лежа', params: '60.0 кг, 3 x 8', rpe: '9' }] // Tonnage = 1440 kg
        }
      ]
    },
    sampleWorkout
  ];

  const chartUrl = generateTrendChartUrl(workoutsHistory);
  console.log('Generated QuickChart URL:');
  console.log(chartUrl);
  console.log('──────────────────────────────────────');
  if (!chartUrl.startsWith('https://quickchart.io/chart?')) {
    throw new Error('QuickChart URL generation failed or returned invalid URL prefix');
  }
  console.log('✅ QuickChart URL generated successfully and is syntactically valid!');

  console.log('\n⭐⭐⭐ ALL ANALYSIS MODULE TESTS PASSED SUCCESSFULLY! ⭐⭐⭐');

} catch (e) {
  console.error('❌ Analysis verification failed:', e);
  process.exit(1);
}
