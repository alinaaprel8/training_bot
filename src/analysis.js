/**
 * Business logic for workout analysis, muscle group classification,
 * metrics calculations, and Chart.js configuration for QuickChart.io.
 */

/**
 * Classifies an exercise name into one of the target muscle groups:
 * Chest (Грудь), Legs (Ноги), Back (Спина), Shoulders (Плечи), Arms (Руки), Core (Кор).
 * Defaults to Other (Другое) if no match is found.
 * 
 * @param {string} name - The name of the exercise.
 * @returns {string} The classified muscle group.
 */
export function classifyExercise(name) {
  if (!name) return 'Другое';
  const cleanName = name.toLowerCase().trim();

  // 1. Arms (Руки)
  const isArms = (
    /бицепс/i.test(cleanName) ||
    /трицепс/i.test(cleanName) ||
    /разгибан.*блок/i.test(cleanName) ||
    /сгибан.*рук/i.test(cleanName) ||
    /молот/i.test(cleanName) ||
    /французск/i.test(cleanName)
  );
  if (isArms) return 'Руки';

  // 2. Legs (Ноги)
  const isLegs = (
    /приседан/i.test(cleanName) ||
    /сед/i.test(cleanName) ||
    /румынск/i.test(cleanName) ||
    /сгибан.*ног/i.test(cleanName) ||
    /разгибан.*ног/i.test(cleanName) ||
    /голен/i.test(cleanName) ||
    /носки/i.test(cleanName) ||
    /выпад/i.test(cleanName) ||
    /икр/i.test(cleanName) ||
    /становая.*тяга/i.test(cleanName)
  );
  if (isLegs) return 'Ноги';

  // 3. Chest (Грудь)
  const isChest = (
    /жим.*лежа/i.test(cleanName) ||
    /жим.*наклон/i.test(cleanName) ||
    /сведени/i.test(cleanName) ||
    /брусья/i.test(cleanName) ||
    /пек-дек/i.test(cleanName) ||
    (/разводк/i.test(cleanName) && !/сторон/i.test(cleanName))
  );
  if (isChest) return 'Грудь';

  // 4. Back (Спина)
  const isBack = (
    /тяга.*блока/i.test(cleanName) ||
    /тяга.*горизонт/i.test(cleanName) ||
    /подтягиван/i.test(cleanName) ||
    /гиперэкстенз/i.test(cleanName) ||
    /тяга.*в.*наклон/i.test(cleanName) ||
    /тяга.*штанги.*наклон/i.test(cleanName) ||
    /тяга.*гантели.*наклон/i.test(cleanName)
  );
  if (isBack) return 'Спина';

  // 5. Shoulders (Плечи)
  const isShoulders = (
    /армейск/i.test(cleanName) ||
    /жим.*стоя/i.test(cleanName) ||
    /жим.*сидя/i.test(cleanName) ||
    /махи/i.test(cleanName) ||
    /face pulls/i.test(cleanName) ||
    /дельт/i.test(cleanName) ||
    /шраг/i.test(cleanName) ||
    (/разводк/i.test(cleanName) && /сторон/i.test(cleanName))
  );
  if (isShoulders) return 'Плечи';

  // 6. Core (Кор)
  const isCore = (
    /пресс/i.test(cleanName) ||
    /планка/i.test(cleanName) ||
    /подъем.*ног/i.test(cleanName) ||
    /скручиван/i.test(cleanName)
  );
  if (isCore) return 'Кор';

  return 'Другое';
}

/**
 * Parses exercise parameters string (e.g. "55.0 кг, 2 x 8" or "3 x 12 (собственный вес)")
 * to calculate tonnage, sets, reps, and check if it's weight-based.
 * 
 * @param {string} paramsStr - The raw exercise parameters string.
 * @returns {object} The parsed parameters object.
 */
export function parseExerciseParams(paramsStr) {
  const result = {
    weight: 0,
    sets: 0,
    reps: 0,
    tonnage: 0,
    isWeightBased: false
  };

  if (!paramsStr) return result;
  
  const cleanStr = paramsStr.trim().toLowerCase();

  // Pattern 1: "55.0 кг, 2 x 8" or "55.0, 2 x 8" or "10 kg, 3x15"
  const pattern1 = /([0-9.,]+)\s*(?:кг|kg)?\s*,\s*(\d+)\s*[xх*]\s*(\d+)/i;
  let match = cleanStr.match(pattern1);
  if (match) {
    const weight = parseFloat(match[1].replace(',', '.'));
    const sets = parseInt(match[2], 10);
    const reps = parseInt(match[3], 10);
    if (!isNaN(weight) && !isNaN(sets) && !isNaN(reps)) {
      result.weight = weight;
      result.sets = sets;
      result.reps = reps;
      result.tonnage = weight * sets * reps;
      result.isWeightBased = weight > 0;
      return result;
    }
  }

  // Pattern 2: "55.0 кг x 2 x 8"
  const pattern2 = /([0-9.,]+)\s*(?:кг|kg)?\s*[xх*]\s*(\d+)\s*[xх*]\s*(\d+)/i;
  match = cleanStr.match(pattern2);
  if (match) {
    const weight = parseFloat(match[1].replace(',', '.'));
    const sets = parseInt(match[2], 10);
    const reps = parseInt(match[3], 10);
    if (!isNaN(weight) && !isNaN(sets) && !isNaN(reps)) {
      result.weight = weight;
      result.sets = sets;
      result.reps = reps;
      result.tonnage = weight * sets * reps;
      result.isWeightBased = weight > 0;
      return result;
    }
  }

  // Pattern 3: "3 x 15" or "3 x 15 (собственный вес)" or "3 x 15 св"
  const pattern3 = /(\d+)\s*[xх*]\s*(\d+)/i;
  match = cleanStr.match(pattern3);
  if (match) {
    const sets = parseInt(match[1], 10);
    const reps = parseInt(match[2], 10);
    if (!isNaN(sets) && !isNaN(reps)) {
      result.sets = sets;
      result.reps = reps;
      // tonnage remains 0 for bodyweight/cardio
      return result;
    }
  }

  return result;
}

/**
 * Calculates day metrics from structured day object.
 * 
 * @param {object} dayObj - Day object with exercises.
 * @returns {object} Day metrics summary.
 */
export function calculateDayMetrics(dayObj) {
  let totalTonnage = 0;
  let totalSets = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  
  const muscleGroups = {
    'Грудь': { tonnage: 0, sets: 0 },
    'Ноги': { tonnage: 0, sets: 0 },
    'Спина': { tonnage: 0, sets: 0 },
    'Плечи': { tonnage: 0, sets: 0 },
    'Руки': { tonnage: 0, sets: 0 },
    'Кор': { tonnage: 0, sets: 0 },
    'Другое': { tonnage: 0, sets: 0 }
  };

  if (dayObj && dayObj.exercises && Array.isArray(dayObj.exercises)) {
    dayObj.exercises.forEach(ex => {
      const parsed = parseExerciseParams(ex.params);
      const group = classifyExercise(ex.name);
      
      totalTonnage += parsed.tonnage;
      totalSets += parsed.sets;
      
      if (group in muscleGroups) {
        muscleGroups[group].tonnage += parsed.tonnage;
        muscleGroups[group].sets += parsed.sets;
      } else {
        muscleGroups['Другое'].tonnage += parsed.tonnage;
        muscleGroups['Другое'].sets += parsed.sets;
      }
      
      if (ex.rpe) {
        const cleanRpe = ex.rpe.trim().replace(',', '.');
        const rpeVal = parseFloat(cleanRpe);
        if (!isNaN(rpeVal)) {
          rpeSum += rpeVal;
          rpeCount++;
        }
      }
    });
  }

  const avgRpe = rpeCount > 0 ? (rpeSum / rpeCount) : 0;

  return {
    totalTonnage,
    totalSets,
    avgRpe,
    muscleGroups
  };
}

/**
 * Calculates week metrics from structured workout object.
 * 
 * @param {object} workoutObj - Workout object with days.
 * @returns {object} Week metrics summary.
 */
export function calculateWeekMetrics(workoutObj) {
  let totalTonnage = 0;
  let totalSets = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  
  const muscleGroups = {
    'Грудь': { tonnage: 0, sets: 0 },
    'Ноги': { tonnage: 0, sets: 0 },
    'Спина': { tonnage: 0, sets: 0 },
    'Плечи': { tonnage: 0, sets: 0 },
    'Руки': { tonnage: 0, sets: 0 },
    'Кор': { tonnage: 0, sets: 0 },
    'Другое': { tonnage: 0, sets: 0 }
  };

  const daysMetrics = [];

  if (workoutObj && workoutObj.days_data && Array.isArray(workoutObj.days_data)) {
    workoutObj.days_data.forEach(day => {
      const dayMetrics = calculateDayMetrics(day);
      daysMetrics.push({
        day: day.day,
        date: day.date,
        type: day.type,
        ...dayMetrics
      });
      
      totalTonnage += dayMetrics.totalTonnage;
      totalSets += dayMetrics.totalSets;
      
      Object.keys(muscleGroups).forEach(group => {
        muscleGroups[group].tonnage += dayMetrics.muscleGroups[group].tonnage;
        muscleGroups[group].sets += dayMetrics.muscleGroups[group].sets;
      });
      
      if (day.exercises && Array.isArray(day.exercises)) {
        day.exercises.forEach(ex => {
          if (ex.rpe) {
            const cleanRpe = ex.rpe.trim().replace(',', '.');
            const rpeVal = parseFloat(cleanRpe);
            if (!isNaN(rpeVal)) {
              rpeSum += rpeVal;
              rpeCount++;
            }
          }
        });
      }
    });
  }

  const avgRpe = rpeCount > 0 ? (rpeSum / rpeCount) : 0;

  return {
    totalTonnage,
    totalSets,
    avgRpe,
    muscleGroups,
    daysMetrics
  };
}

// Muscle groups to Russian visual format mapping
const muscleGroupLabels = {
  'Грудь': '🛡️ Грудь',
  'Ноги': '🦵 Ноги',
  'Спина': '🦾 Спина',
  'Плечи': '🎯 Плечи',
  'Руки': '💪 Руки',
  'Кор': '🧱 Кор',
  'Другое': '❓ Другое'
};

/**
 * Formats a day analysis text in markdown.
 * 
 * @param {object} dayObj - Day object with exercises.
 * @returns {string} Formatted markdown text.
 */
export function formatDayAnalysis(dayObj) {
  const metrics = calculateDayMetrics(dayObj);
  
  let text = `📊 *Анализ дня: ${dayObj.day}${dayObj.date ? ` (${dayObj.date})` : ''}*\n`;
  if (dayObj.type) text += `📋 Тип: ${dayObj.type}\n`;
  text += `────────────────────\n`;
  text += `🏋️‍♂️ *Общий тоннаж:* ${metrics.totalTonnage.toLocaleString('ru-RU')} кг\n`;
  text += `🔄 *Всего подходов:* ${metrics.totalSets}\n`;
  text += `⏱ *Средний RPE:* ${metrics.avgRpe > 0 ? metrics.avgRpe.toFixed(1) : '—'}\n\n`;

  text += `*Распределение по группам мышц:*\n`;
  let hasGroups = false;
  
  Object.keys(muscleGroupLabels).forEach(key => {
    const groupData = metrics.muscleGroups[key];
    if (groupData.sets > 0) {
      hasGroups = true;
      text += `• ${muscleGroupLabels[key]}: ${groupData.tonnage.toLocaleString('ru-RU')} кг (${groupData.sets} подх.)\n`;
    }
  });

  if (!hasGroups) {
    text += `_Упражнения отсутствуют или не содержат параметров подходов._\n`;
  }

  return text;
}

/**
 * Formats a week analysis text in markdown.
 * 
 * @param {object} workoutObj - The workout object from DB.
 * @returns {string} Formatted markdown text.
 */
export function formatWeekAnalysis(workoutObj) {
  const metrics = calculateWeekMetrics(workoutObj);
  
  let text = `📊 *Анализ недели ${workoutObj.week_number}*\n`;
  if (workoutObj.title) text += `📝 ${workoutObj.title}\n`;
  text += `────────────────────\n`;
  text += `🏋️‍♂️ *Общий тоннаж:* ${metrics.totalTonnage.toLocaleString('ru-RU')} кг\n`;
  text += `🔄 *Всего подходов:* ${metrics.totalSets}\n`;
  text += `⏱ *Средний RPE:* ${metrics.avgRpe > 0 ? metrics.avgRpe.toFixed(1) : '—'}\n\n`;

  text += `*Распределение по группам мышц:*\n`;
  Object.keys(muscleGroupLabels).forEach(key => {
    const groupData = metrics.muscleGroups[key];
    if (groupData.sets > 0) {
      text += `• ${muscleGroupLabels[key]}: ${groupData.tonnage.toLocaleString('ru-RU')} кг (${groupData.sets} подх.)\n`;
    }
  });

  text += `\n* breakdown по дням:*\n`;
  metrics.daysMetrics.forEach(dm => {
    const rpeText = dm.avgRpe > 0 ? `, RPE ${dm.avgRpe.toFixed(1)}` : '';
    text += `• *${dm.day}*: ${dm.totalTonnage.toLocaleString('ru-RU')} кг (${dm.totalSets} подх.${rpeText})\n`;
  });

  return text;
}

/**
 * Parses dynamic body weight from biometrics.weight string.
 * 
 * @param {string} weightStr - Raw weight string (e.g. "82.5", "82.5кг").
 * @returns {number|null} Clean numeric value or null.
 */
export function parseWeight(weightStr) {
  if (!weightStr) return null;
  const match = weightStr.trim().replace(',', '.').match(/^([0-9.]+)/);
  if (match) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Generates a Chart.js configuration for QuickChart.io and returns the fully formed encoded URL.
 * Displays body weight, total weekly tonnage, and average weekly RPE across multiple weeks.
 * 
 * @param {Array} workoutsList - Array of workouts sorted by week number.
 * @returns {string} The QuickChart.io URL.
 */
export function generateTrendChartUrl(workoutsList) {
  if (!workoutsList || workoutsList.length === 0) {
    return '';
  }

  // Extract labels and data arrays
  const labels = [];
  const tonnageData = []; // scaled to tons (tonnage / 1000) for visual excellence
  const weightData = [];
  const rpeData = [];

  workoutsList.forEach(w => {
    labels.push(`Неделя ${w.week_number}`);
    
    // 1. Tonnage
    const metrics = calculateWeekMetrics(w);
    tonnageData.push(parseFloat((metrics.totalTonnage / 1000).toFixed(2))); // converted to tons

    // 2. Weight
    const wVal = parseWeight(w.biometrics?.weight);
    weightData.push(wVal); // might be null, Chart.js handles null/gaps

    // 3. RPE
    rpeData.push(metrics.avgRpe > 0 ? parseFloat(metrics.avgRpe.toFixed(2)) : null);
  });

  // ChartJS config structure for QuickChart (defaults to ChartJS v2)
  const chartConfig = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Тоннаж (т)',
          type: 'bar',
          data: tonnageData,
          yAxisID: 'y-axis-tonnage',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Вес тела (кг)',
          type: 'line',
          data: weightData,
          yAxisID: 'y-axis-weight',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          fill: false,
          tension: 0.4,
          spanGaps: true
        },
        {
          label: 'Средний RPE',
          type: 'line',
          data: rpeData,
          yAxisID: 'y-axis-rpe',
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          fill: false,
          tension: 0.4,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      title: {
        display: true,
        text: 'Анализ тренировочного прогресса и веса тела',
        fontSize: 16,
        fontColor: '#ffffff',
        padding: 20
      },
      legend: {
        position: 'top',
        labels: {
          fontColor: '#cccccc',
          fontSize: 12
        }
      },
      scales: {
        xAxes: [{
          ticks: {
            fontColor: '#aaaaaa',
            fontSize: 11
          },
          gridLines: {
            color: 'rgba(255, 255, 255, 0.08)'
          }
        }],
        yAxes: [
          {
            id: 'y-axis-tonnage',
            type: 'linear',
            position: 'right',
            ticks: {
              fontColor: '#36a2eb',
              fontSize: 11,
              beginAtZero: true
            },
            gridLines: {
              drawOnChartArea: false
            },
            scaleLabel: {
              display: true,
              labelString: 'Тоннаж (тонны)',
              fontColor: '#36a2eb',
              fontSize: 12
            }
          },
          {
            id: 'y-axis-weight',
            type: 'linear',
            position: 'left',
            ticks: {
              fontColor: '#ff6384',
              fontSize: 11
            },
            gridLines: {
              color: 'rgba(255, 255, 255, 0.08)'
            },
            scaleLabel: {
              display: true,
              labelString: 'Вес тела (кг)',
              fontColor: '#ff6384',
              fontSize: 12
            }
          },
          {
            id: 'y-axis-rpe',
            type: 'linear',
            position: 'left',
            ticks: {
              fontColor: '#4bc0c0',
              fontSize: 11,
              min: 0,
              max: 10
            },
            gridLines: {
              drawOnChartArea: false
            },
            scaleLabel: {
              display: true,
              labelString: 'Средний RPE',
              fontColor: '#4bc0c0',
              fontSize: 12
            }
          }
        ]
      }
    }
  };

  // Build the complete QuickChart URL with sleek dark background
  const baseUrl = 'https://quickchart.io/chart';
  const queryParams = [
    `bkg=${encodeURIComponent('#15151c')}`, // Deep premium dark background
    `w=800`,
    `h=450`,
    `c=${encodeURIComponent(JSON.stringify(chartConfig))}`
  ];

  return `${baseUrl}?${queryParams.join('&')}`;
}
