/**
 * Parses a workout Markdown file.
 * Supports both structured workout templates and fallback for arbitrary Markdown.
 * 
 * @param {string} markdown - The raw markdown file content.
 * @returns {object} The parsed workout data.
 */
export function parseMarkdown(markdown) {
  const result = {
    week_number: null,
    start_date: null,
    title: '',
    biometrics: {
      weight: '',
      sleep: '',
      mood: ''
    },
    days_data: [],
    raw_markdown: markdown,
    is_structured: false
  };

  // Normalize line endings
  const content = markdown.replace(/\r\n/g, '\n');

  // 1. Parse YAML Frontmatter
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let contentWithoutYaml = content;
  
  if (yamlMatch) {
    const yamlText = yamlMatch[1];
    contentWithoutYaml = content.substring(yamlMatch[0].length).trim();
    
    const weekMatch = yamlText.match(/week:\s*(\d+)/i);
    const dateMatch = yamlText.match(/start_date:\s*([\d-]+)/i);
    
    if (weekMatch) result.week_number = parseInt(weekMatch[1], 10);
    if (dateMatch) result.start_date = dateMatch[1].trim();
  }

  // 2. Find Title (first H1 line `# `)
  const titleMatch = contentWithoutYaml.match(/^#\s*(.*?)$/m);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  } else {
    result.title = 'Без названия';
  }

  // 3. Parse Biometrics
  const bioSectionMatch = contentWithoutYaml.match(/Состояние на начало недели:([\s\S]*?)(?=\n---|\n##|$)/i);
  if (bioSectionMatch) {
    const bioText = bioSectionMatch[1];
    const weightMatch = bioText.match(/-\s*Вес:\s*(.*?)$/mi);
    const sleepMatch = bioText.match(/-\s*Сон:\s*(.*?)$/mi);
    const moodMatch = bioText.match(/-\s*Настроение:\s*(.*?)$/mi);
    
    if (weightMatch) result.biometrics.weight = weightMatch[1].trim();
    if (sleepMatch) result.biometrics.sleep = sleepMatch[1].trim();
    if (moodMatch) result.biometrics.mood = moodMatch[1].trim();
  }

  // 4. Parse Days
  // Split the document by day headers: "## "
  const dayBlocks = contentWithoutYaml.split(/\n(?=##\s)/);
  
  // If the first block actually starts with "## ", split will put empty or intro text in dayBlocks[0]
  let firstIndex = 0;
  if (!dayBlocks[0].startsWith('##')) {
    firstIndex = 1; // Skip introduction block
  }

  for (let i = firstIndex; i < dayBlocks.length; i++) {
    const block = dayBlocks[i].trim();
    if (!block.startsWith('##')) continue;

    const lines = block.split('\n');
    const headerLine = lines[0];
    
    // Parse Day Header: e.g. "## Пн (18.05) | Upper Power (Deload) | MODERATE CARB"
    // We split by "|"
    const headerParts = headerLine.replace(/^##\s*/, '').split('|').map(p => p.trim());
    
    const dayAndDate = headerParts[0] || '';
    const dayType = headerParts[1] || '';
    const dayDiet = headerParts[2] || '';

    // Extract day name and date: e.g. "Пн (18.05)" or just "Пн"
    let dayName = dayAndDate;
    let dayDate = '';
    const dateRegexMatch = dayAndDate.match(/^(.*?)\s*\((.*?)\)$/);
    if (dateRegexMatch) {
      dayName = dateRegexMatch[1].trim();
      dayDate = dateRegexMatch[2].trim();
    }

    const dayObj = {
      day: dayName,
      date: dayDate,
      type: dayType,
      diet: dayDiet,
      exercises: []
    };

    // Parse exercises in this block
    let currentExercise = null;
    
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;

      // Match exercise list item: "1. Name — params, RPE = val"
      // Support various dashes: —, –, -
      const exerciseMatch = line.match(/^(\d+)\.\s*(.+?)\s*[—–-]\s*(.+?),\s*RPE\s*=\s*(.*)$/i);
      
      if (exerciseMatch) {
        currentExercise = {
          id: parseInt(exerciseMatch[1], 10),
          name: exerciseMatch[2].trim(),
          params: exerciseMatch[3].trim(),
          rpe: exerciseMatch[4].trim(),
          comment: ''
        };
        dayObj.exercises.push(currentExercise);
      } else {
        // Fallback for simple list items that do not strictly match the pattern:
        const simpleListItem = line.match(/^(\d+)\.\s*(.*)$/);
        if (simpleListItem) {
          currentExercise = {
            id: parseInt(simpleListItem[1], 10),
            name: simpleListItem[2].trim(),
            params: '',
            rpe: '',
            comment: ''
          };
          dayObj.exercises.push(currentExercise);
        } else {
          // Check if this line is a comment/note for the current exercise:
          // E.g. "   * Примечание: тяжело шло" or "   * тяжело шло"
          // Must have whitespace after bullet to avoid matching dividers like "---"
          const commentMatch = line.match(/^\s*[\*\+-]\s+(?:Примечание:\s*)?(.*)$/i);
          if (commentMatch && currentExercise) {
            currentExercise.comment = commentMatch[1].trim();
          }
        }
      }
    }

    if (dayObj.exercises.length > 0 || dayObj.day) {
      result.days_data.push(dayObj);
    }
  }

  // Determine if it was structured successfully
  if (result.week_number !== null && result.days_data.length > 0) {
    result.is_structured = true;
  }

  return result;
}

/**
 * Regenerates the Markdown content from structured workout data.
 * 
 * @param {object} workout - The workout object from DB.
 * @returns {string} The formatted Markdown string.
 */
export function generateMarkdown(workout) {
  let md = '';

  // 1. YAML Frontmatter
  md += `---\n`;
  md += `week: ${workout.week_number || ''}\n`;
  md += `start_date: ${workout.start_date || ''}\n`;
  md += `biometrics:\n`;
  md += `---\n\n`;

  // 2. Title
  md += `${workout.title || 'Без названия'}\n\n`;

  // 3. Biometrics
  md += `Состояние на начало недели:\n`;
  md += `- Вес: ${workout.biometrics?.weight ?? ''}\n`;
  md += `- Сон: ${workout.biometrics?.sleep ?? ''}\n`;
  md += `- Настроение: ${workout.biometrics?.mood ?? ''}\n\n`;
  md += `---\n\n`;

  // 4. Days & Exercises
  if (workout.days_data && Array.isArray(workout.days_data)) {
    workout.days_data.forEach((day, index) => {
      let dayHeader = `## ${day.day}`;
      if (day.date) dayHeader += ` (${day.date})`;
      if (day.type || day.diet) {
        dayHeader += ` | ${day.type || ''}`;
        if (day.diet) dayHeader += ` | ${day.diet}`;
      }
      md += `${dayHeader}\n`;

      if (day.exercises && Array.isArray(day.exercises)) {
        day.exercises.forEach((ex) => {
          let exLine = `${ex.id}. ${ex.name}`;
          if (ex.params) {
            exLine += ` — ${ex.params}`;
          } else {
            exLine += ` — `;
          }
          exLine += `, RPE = ${ex.rpe ?? ''}`;
          md += `${exLine}\n`;

          if (ex.comment) {
            md += `   * Примечание: ${ex.comment}\n`;
          }
        });
      }

      if (index < workout.days_data.length - 1) {
        md += `\n---\n\n`;
      }
    });
  }

  return md;
}
