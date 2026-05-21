import { Bot, InlineKeyboard, InputFile } from 'grammy';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { 
  saveUser, 
  saveWorkout, 
  getWorkoutsForUser, 
  getWorkout, 
  updateWorkoutBiometrics, 
  updateWorkoutDays 
} from './db.js';
import { parseMarkdown, generateMarkdown } from './parser.js';
import { 
  formatWeekAnalysis, 
  formatDayAnalysis, 
  generateTrendChartUrl 
} from './analysis.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is not defined in .env file!');
  process.exit(1);
}

const bot = new Bot(token);

// Simple in-memory session store for user dialog states
// Map<telegram_id, { state: string, weekNumber: number, dayIndex?: number, exId?: number }>
const userStates = new Map();

// Helper to escape MarkdownV2 special characters
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

// ----------------------------------------------------
// Keyboard Generators
// ----------------------------------------------------

// 1. Main Menu Keyboard (List of Weeks)
function makeMainMenuKeyboard(userId) {
  const keyboard = new InlineKeyboard();
  const workouts = getWorkoutsForUser(userId);
  
  if (workouts.length > 0) {
    workouts.forEach(w => {
      keyboard.text(`📅 Неделя ${w.week_number} (${w.start_date || '?'})`, `week:${w.week_number}`).row();
    });
  } else {
    keyboard.text('📭 У вас пока нет загруженных недель', 'noop').row();
  }
  
  return keyboard;
}

// 2. Week Menu Keyboard
function makeWeekKeyboard(workout) {
  const keyboard = new InlineKeyboard();
  
  // Day buttons
  workout.days_data.forEach((day, index) => {
    let dayText = `📆 ${day.day}`;
    if (day.date) dayText += ` (${day.date})`;
    if (day.type) dayText += ` | ${day.type.split('(')[0].trim()}`;
    keyboard.text(dayText, `week:${workout.week_number}:day:${index}`).row();
  });
  
  // Service buttons
  keyboard.text('📊 Анализ недели', `week:${workout.week_number}:analysis`).row();
  keyboard.text('📊 Изменить биометрию', `week:${workout.week_number}:edit_bio`).row();
  keyboard.text('📥 Скачать .md', `week:${workout.week_number}:download`)
          .text('📝 Правка текстом', `week:${workout.week_number}:edit_raw`).row();
  keyboard.text('‹ К списку недель', 'menu:main');
  
  return keyboard;
}

// 3. Day Menu Keyboard
function makeDayKeyboard(weekNumber, dayIndex, dayObj) {
  const keyboard = new InlineKeyboard();
  
  // Exercise list
  dayObj.exercises.forEach(ex => {
    let exText = `${ex.id}. ${ex.name}`;
    if (ex.rpe) exText += ` (RPE: ${ex.rpe})`;
    keyboard.text(exText, `week:${weekNumber}:day:${dayIndex}:ex:${ex.id}`).row();
  });
  
  keyboard.text('📊 Анализ дня', `week:${weekNumber}:day:${dayIndex}:analysis`).row();
  keyboard.text('‹ К неделе', `week:${weekNumber}`);
  return keyboard;
}

// 4. Exercise Detail Keyboard
function makeExerciseKeyboard(weekNumber, dayIndex, exId) {
  const keyboard = new InlineKeyboard()
    .text('⚖️ Изменить Вес / Параметры', `week:${weekNumber}:day:${dayIndex}:ex:${exId}:edit_params`).row()
    .text('⏱️ Указать RPE', `week:${weekNumber}:day:${dayIndex}:ex:${exId}:edit_rpe`).row()
    .text('💬 Изменить Примечание', `week:${weekNumber}:day:${dayIndex}:ex:${exId}:edit_comment`).row()
    .text('‹ Назад к тренировке', `week:${weekNumber}:day:${dayIndex}`);
  return keyboard;
}

// 5. RPE Selection Keyboard
function makeRpeKeyboard(weekNumber, dayIndex, exId) {
  const k = new InlineKeyboard()
    .text('6', `rpe_val:${weekNumber}:${dayIndex}:${exId}:6`)
    .text('6.5', `rpe_val:${weekNumber}:${dayIndex}:${exId}:6.5`)
    .text('7', `rpe_val:${weekNumber}:${dayIndex}:${exId}:7`)
    .text('7.5', `rpe_val:${weekNumber}:${dayIndex}:${exId}:7.5`).row()
    .text('8', `rpe_val:${weekNumber}:${dayIndex}:${exId}:8`)
    .text('8.5', `rpe_val:${weekNumber}:${dayIndex}:${exId}:8.5`)
    .text('9', `rpe_val:${weekNumber}:${dayIndex}:${exId}:9`)
    .text('9.5', `rpe_val:${weekNumber}:${dayIndex}:${exId}:9.5`).row()
    .text('10', `rpe_val:${weekNumber}:${dayIndex}:${exId}:10`)
    .text('🚫 Сбросить', `rpe_val:${weekNumber}:${dayIndex}:${exId}:clear`).row()
    .text('⌨️ Ввести вручную', `week:${weekNumber}:day:${dayIndex}:ex:${exId}:rpe_manual`).row()
    .text('‹ Отмена', `week:${weekNumber}:day:${dayIndex}:ex:${exId}`);
  return k;
}

// ----------------------------------------------------
// Handlers and Actions
// ----------------------------------------------------

// /start Command
bot.command('start', (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name || '';
  const username = ctx.from.username || '';
  
  saveUser(userId, username, firstName);
  
  const text = `👋 *Привет, ${escapeMarkdown(firstName)}\\!*\n\n` +
               `Я бот для хранения и интерактивного ведения тренировочных логов в формате *Markdown*\\.\n\n` +
               `✍️ **Как мной пользоваться?**\n` +
               `1\\. Загрузи свой файл \`.md\` с тренировочной неделей \\(просто пришли его в чат\\)\\.\n` +
               `2\\. Просматривай тренировки и редактируй RPE, веса и комментарии с помощью удобных кнопок\\.\n` +
               `3\\. В любой момент скачивай обновленный файл обратно\\.\n\n` +
               `👇 **Твои загруженные недели:**`;
               
  ctx.reply(text, {
    parse_mode: 'MarkdownV2',
    reply_markup: makeMainMenuKeyboard(userId)
  });
});

// File Upload Handler (Markdown Document)
bot.on('message:document', async (ctx) => {
  const userId = ctx.from.id;
  const doc = ctx.message.document;
  
  if (!doc.file_name.endsWith('.md')) {
    return ctx.reply('⚠️ Пожалуйста, пришлите файл с расширением `.md` (Markdown).');
  }
  
  const waitMsg = await ctx.reply('⏳ Загрузка и анализ файла...');
  
  try {
    const file = await ctx.api.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    
    // Fetch file content
    const response = await fetch(fileUrl);
    const text = await response.text();
    
    // Parse
    const parsed = parseMarkdown(text);
    
    // Track user
    saveUser(userId, ctx.from.username, ctx.from.first_name);
    
    if (parsed.is_structured) {
      saveWorkout(
        userId, 
        parsed.week_number, 
        parsed.start_date, 
        parsed.title, 
        parsed.biometrics, 
        parsed.days_data, 
        text
      );
      
      await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
      
      const successText = `✅ *Файл успешно загружен\\!*\n\n` +
                          `📅 **Неделя ${parsed.week_number}** успешно добавлена\\.\n` +
                          `Упражнений распознано: *${parsed.days_data.reduce((acc, d) => acc + d.exercises.length, 0)}*\\.\n\n` +
                          `Используйте интерактивное меню для просмотра и редактирования:`;
                          
      ctx.reply(successText, {
        parse_mode: 'MarkdownV2',
        reply_markup: makeWeekKeyboard(parsed)
      });
    } else {
      // Fallback: save as raw markdown
      const fallbackWeekNumber = Date.now() % 100000;
      const currentDate = new Date().toISOString().split('T')[0];
      
      saveWorkout(
        userId,
        fallbackWeekNumber,
        currentDate,
        doc.file_name,
        { weight: '', sleep: '', mood: '' },
        [],
        text
      );
      
      await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
      
      ctx.reply(`📝 Файл загружен как текстовая заметка (не удалось распознать тренировки по нашему строгому шаблону).\n\nВы можете скачать его обратно по кнопке ниже:`, {
        reply_markup: new InlineKeyboard()
          .text('📥 Скачать файл', `week:${fallbackWeekNumber}:download`).row()
          .text('‹ К списку недель', 'menu:main')
      });
    }
  } catch (error) {
    console.error('File parsing error:', error);
    await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
    ctx.reply('❌ Ошибка при чтении или разборе файла. Пожалуйста, убедитесь, что это текстовый файл Markdown.');
  }
});

// Callback Query handlers
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  
  await ctx.answerCallbackQuery();
  
  if (data === 'noop') return;
  
  if (data === 'menu:main') {
    userStates.delete(userId);
    return ctx.editMessageText('👇 **Ваши загруженные недели:**', {
      reply_markup: makeMainMenuKeyboard(userId)
    });
  }
  
  // Week Analysis: "week:<week_number>:analysis"
  if (data.startsWith('week:') && data.endsWith(':analysis') && !data.includes(':day:')) {
    const weekNumber = parseInt(data.split(':')[1], 10);
    const workout = getWorkout(userId, weekNumber);
    if (!workout) return ctx.reply('⚠️ Неделя не найдена.');

    const analysisText = formatWeekAnalysis(workout);
    
    // Fetch history for chart
    const workoutsList = getWorkoutsForUser(userId);
    // Sort by week number ascending
    workoutsList.sort((a, b) => a.week_number - b.week_number);
    
    const chartUrl = generateTrendChartUrl(workoutsList);
    
    if (chartUrl) {
      try {
        if (analysisText.length <= 1024) {
          await ctx.replyWithPhoto(chartUrl, {
            caption: analysisText,
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('‹ К неделе', `week:${weekNumber}`)
          });
        } else {
          await ctx.replyWithPhoto(chartUrl, {
            caption: `📊 График прогресса для Недели ${weekNumber}`
          });
          await ctx.reply(analysisText, {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('‹ К неделе', `week:${weekNumber}`)
          });
        }
      } catch (err) {
        console.error('Error sending chart photo:', err);
        await ctx.reply(analysisText + '\n\n⚠️ _Не удалось загрузить график прогресса_', {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('‹ К неделе', `week:${weekNumber}`)
        });
      }
    } else {
      await ctx.reply(analysisText, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('‹ К неделе', `week:${weekNumber}`)
      });
    }
    return;
  }

  // Day Analysis: "week:<week_number>:day:<day_index>:analysis"
  if (data.startsWith('week:') && data.includes(':day:') && data.endsWith(':analysis')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[3], 10);
    
    const workout = getWorkout(userId, weekNumber);
    if (!workout) return ctx.reply('⚠️ Неделя не найдена.');
    
    const dayObj = workout.days_data[dayIndex];
    if (!dayObj) return ctx.reply('⚠️ День тренировки не найден.');
    
    const dayAnalysisText = formatDayAnalysis(dayObj);
    
    return ctx.reply(dayAnalysisText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('‹ Назад к тренировке', `week:${weekNumber}:day:${dayIndex}`)
    });
  }

  // Week Menu: "week:<week_number>"
  if (data.startsWith('week:') && !data.includes(':day:') && !data.includes(':edit_') && !data.includes(':download') && !data.includes(':analysis')) {
    const weekNumber = parseInt(data.split(':')[1], 10);
    const workout = getWorkout(userId, weekNumber);
    
    if (!workout) return ctx.reply('⚠️ Неделя не найдена.');
    
    let text = `📅 *Неделя ${workout.week_number}* \\(Начало: ${escapeMarkdown(workout.start_date)}\\)\n`;
    text += `🔥 *${escapeMarkdown(workout.title)}*\n\n`;
    text += `📊 **Состояние на начало недели:**\n`;
    text += `⚖️ Вес: *${escapeMarkdown(workout.biometrics.weight || '—')}*\n`;
    text += `⏱️ Сон: *${escapeMarkdown(workout.biometrics.sleep || '—')}*\n`;
    text += `😊 Настроение: *${escapeMarkdown(workout.biometrics.mood || '—')}*`;
    
    return ctx.editMessageText(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: makeWeekKeyboard(workout)
    });
  }
  
  // Day Menu: "week:<week_number>:day:<day_index>"
  if (data.startsWith('week:') && data.includes(':day:') && !data.includes(':ex:')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[3], 10);
    
    const workout = getWorkout(userId, weekNumber);
    if (!workout) return ctx.reply('⚠️ Неделя не найдена.');
    
    const dayObj = workout.days_data[dayIndex];
    if (!dayObj) return ctx.reply('⚠️ День тренировки не найден.');
    
    let text = `📆 *${escapeMarkdown(dayObj.day)}*`;
    if (dayObj.date) text += ` *\\(${escapeMarkdown(dayObj.date)}\\)*`;
    if (dayObj.type) text += ` \\| *${escapeMarkdown(dayObj.type)}*`;
    if (dayObj.diet) text += ` \\| *${escapeMarkdown(dayObj.diet)}*`;
    text += `\n\n`;
    
    dayObj.exercises.forEach(ex => {
      text += `🏋️ **${ex.id}\\. ${escapeMarkdown(ex.name)}**\n`;
      text += `   ⚙️ Параметры: _${escapeMarkdown(ex.params || '—')}_\n`;
      text += `   ⏱️ RPE: *${escapeMarkdown(ex.rpe || '—')}*\n`;
      if (ex.comment) {
        text += `   💬 Примечание: _${escapeMarkdown(ex.comment)}_\n`;
      }
      text += `\n`;
    });
    
    return ctx.editMessageText(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: makeDayKeyboard(weekNumber, dayIndex, dayObj)
    });
  }
  
  // Exercise Detail Menu: "week:<week_number>:day:<day_index>:ex:<ex_id>"
  if (data.startsWith('week:') && data.includes(':day:') && data.includes(':ex:') && !data.includes(':edit_') && !data.includes(':rpe_')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[3], 10);
    const exId = parseInt(parts[5], 10);
    
    const workout = getWorkout(userId, weekNumber);
    const ex = workout?.days_data[dayIndex]?.exercises.find(e => e.id === exId);
    if (!ex) return ctx.reply('⚠️ Упражнение не найдено.');
    
    const text = `🏋️ **${escapeMarkdown(ex.name)}**\n\n` +
                 `⚖️ Параметры: *${escapeMarkdown(ex.params || '—')}*\n` +
                 `⏱️ RPE: *${escapeMarkdown(ex.rpe || 'Не указано')}*\n` +
                 `💬 Примечание: *${escapeMarkdown(ex.comment || 'Нет')}*`;
                 
    return ctx.editMessageText(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: makeExerciseKeyboard(weekNumber, dayIndex, exId)
    });
  }
  
  // Trigger RPE Selector
  if (data.startsWith('week:') && data.includes(':edit_rpe')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[3], 10);
    const exId = parseInt(parts[5], 10);
    
    const workout = getWorkout(userId, weekNumber);
    const ex = workout?.days_data[dayIndex]?.exercises.find(e => e.id === exId);
    
    return ctx.editMessageText(`Выберите RPE для упражнения *${escapeMarkdown(ex.name)}*:`, {
      parse_mode: 'MarkdownV2',
      reply_markup: makeRpeKeyboard(weekNumber, dayIndex, exId)
    });
  }
  
  // Handle RPE Selection Action
  if (data.startsWith('rpe_val:')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[2], 10);
    const exId = parseInt(parts[3], 10);
    const rpeVal = parts[4];
    
    const workout = getWorkout(userId, weekNumber);
    if (!workout) return ctx.reply('⚠️ Неделя не найдена.');
    
    const ex = workout.days_data[dayIndex].exercises.find(e => e.id === exId);
    if (!ex) return ctx.reply('⚠️ Упражнение не найдено.');
    
    ex.rpe = (rpeVal === 'clear') ? '' : rpeVal;
    
    // Regenerate markdown and update DB
    const newMarkdown = generateMarkdown(workout);
    updateWorkoutDays(userId, weekNumber, workout.days_data, newMarkdown);
    
    // Render back detail menu
    const text = `🏋️ **${escapeMarkdown(ex.name)}**\n\n` +
                 `⚖️ Параметры: *${escapeMarkdown(ex.params || '—')}*\n` +
                 `⏱️ RPE: *${escapeMarkdown(ex.rpe || 'Не указано')}* \\(Обновлено\\)\n` +
                 `💬 Примечание: *${escapeMarkdown(ex.comment || 'Нет')}*`;
                 
    return ctx.editMessageText(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: makeExerciseKeyboard(weekNumber, dayIndex, exId)
    });
  }
  
  // Trigger Parameter input dialog
  if (data.startsWith('week:') && data.includes(':edit_params')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[3], 10);
    const exId = parseInt(parts[5], 10);
    
    userStates.set(userId, { state: 'awaiting_params', weekNumber, dayIndex, exId });
    return ctx.reply('⌨️ Введите новые параметры упражнения (например, `57.5 кг, 3 x 8`):');
  }
  
  // Trigger Comment input dialog
  if (data.startsWith('week:') && data.includes(':edit_comment')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[3], 10);
    const exId = parseInt(parts[5], 10);
    
    userStates.set(userId, { state: 'awaiting_comment', weekNumber, dayIndex, exId });
    return ctx.reply('⌨️ Введите новое примечание к упражнению:');
  }
  
  // Trigger Custom RPE input dialog
  if (data.startsWith('week:') && data.includes(':rpe_manual')) {
    const parts = data.split(':');
    const weekNumber = parseInt(parts[1], 10);
    const dayIndex = parseInt(parts[3], 10);
    const exId = parseInt(parts[5], 10);
    
    userStates.set(userId, { state: 'awaiting_rpe', weekNumber, dayIndex, exId });
    return ctx.reply('⌨️ Введите значение RPE (например, `8.5` или `9-10`):');
  }
  
  // Trigger Biometrics input dialog
  if (data.startsWith('week:') && data.includes(':edit_bio')) {
    const weekNumber = parseInt(data.split(':')[1], 10);
    userStates.set(userId, { state: 'awaiting_bio_weight', weekNumber });
    return ctx.reply('⌨️ Введите ваш Вес на начало недели (или прочерк):');
  }
  
  // Download .md file
  if (data.startsWith('week:') && data.includes(':download')) {
    const weekNumber = parseInt(data.split(':')[1], 10);
    const workout = getWorkout(userId, weekNumber);
    if (!workout) return ctx.reply('⚠️ Неделя не найдена.');
    
    // Save to temp file
    const tempDir = 'temp';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const filePath = path.join(tempDir, `week_${weekNumber}_workout.md`);
    fs.writeFileSync(filePath, workout.raw_markdown);
    
    await ctx.replyWithDocument(new InputFile(filePath, `Week_${weekNumber}_Workout.md`), {
      caption: `📄 Лог тренировок на Неделю ${weekNumber}.`
    });
    
    // Clean up
    fs.unlinkSync(filePath);
    return;
  }
  
  // Raw Edit Command (Sends markdown text to user to edit)
  if (data.startsWith('week:') && data.includes(':edit_raw')) {
    const weekNumber = parseInt(data.split(':')[1], 10);
    const workout = getWorkout(userId, weekNumber);
    if (!workout) return ctx.reply('⚠️ Неделя не найдена.');
    
    userStates.set(userId, { state: 'awaiting_raw_md', weekNumber });
    
    await ctx.reply('✏️ Скопируйте следующее сообщение с разметкой, отредактируйте его и отправьте обратно в чат в ответ.');
    return ctx.reply(`\`\`\`markdown\n${workout.raw_markdown}\n\`\`\``);
  }
});

// Text messages / Dialog input handler
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const userText = ctx.message.text.trim();
  const stateObj = userStates.get(userId);
  
  if (!stateObj) {
    // If no active dialogue state, guide user to /start
    return ctx.reply('Для работы с тренировками напишите /start или пришлите файл тренировки `.md`.');
  }
  
  const { state, weekNumber, dayIndex, exId } = stateObj;
  
  try {
    // 1. Awaiting Params
    if (state === 'awaiting_params') {
      const workout = getWorkout(userId, weekNumber);
      const ex = workout.days_data[dayIndex].exercises.find(e => e.id === exId);
      
      ex.params = userText;
      
      const newMarkdown = generateMarkdown(workout);
      updateWorkoutDays(userId, weekNumber, workout.days_data, newMarkdown);
      userStates.delete(userId);
      
      ctx.reply(`✅ Параметры упражнения *${escapeMarkdown(ex.name)}* изменены на \`${escapeMarkdown(userText)}\`\\.`, {
        parse_mode: 'MarkdownV2',
        reply_markup: new InlineKeyboard().text('🏋️ Назад к упражнению', `week:${weekNumber}:day:${dayIndex}:ex:${exId}`)
      });
    }
    
    // 2. Awaiting Custom RPE
    else if (state === 'awaiting_rpe') {
      const workout = getWorkout(userId, weekNumber);
      const ex = workout.days_data[dayIndex].exercises.find(e => e.id === exId);
      
      ex.rpe = userText;
      
      const newMarkdown = generateMarkdown(workout);
      updateWorkoutDays(userId, weekNumber, workout.days_data, newMarkdown);
      userStates.delete(userId);
      
      ctx.reply(`✅ RPE для *${escapeMarkdown(ex.name)}* изменено на \`${escapeMarkdown(userText)}\`\\.`, {
        parse_mode: 'MarkdownV2',
        reply_markup: new InlineKeyboard().text('🏋️ Назад к упражнению', `week:${weekNumber}:day:${dayIndex}:ex:${exId}`)
      });
    }
    
    // 3. Awaiting Comment
    else if (state === 'awaiting_comment') {
      const workout = getWorkout(userId, weekNumber);
      const ex = workout.days_data[dayIndex].exercises.find(e => e.id === exId);
      
      ex.comment = userText;
      
      const newMarkdown = generateMarkdown(workout);
      updateWorkoutDays(userId, weekNumber, workout.days_data, newMarkdown);
      userStates.delete(userId);
      
      ctx.reply(`✅ Примечание для *${escapeMarkdown(ex.name)}* обновлено на: _${escapeMarkdown(userText)}_`, {
        parse_mode: 'MarkdownV2',
        reply_markup: new InlineKeyboard().text('🏋️ Назад к упражнению', `week:${weekNumber}:day:${dayIndex}:ex:${exId}`)
      });
    }
    
    // 4. Awaiting Biometrics Step 1: Weight
    else if (state === 'awaiting_bio_weight') {
      const workout = getWorkout(userId, weekNumber);
      workout.biometrics.weight = userText;
      
      // Move to sleep input
      userStates.set(userId, { state: 'awaiting_bio_sleep', weekNumber });
      ctx.reply('⌨️ Введите продолжительность Сна (например, `7ч 30м` или прочерк):');
    }
    
    // 5. Awaiting Biometrics Step 2: Sleep
    else if (state === 'awaiting_bio_sleep') {
      const workout = getWorkout(userId, weekNumber);
      workout.biometrics.sleep = userText;
      
      // Move to mood input
      userStates.set(userId, { state: 'awaiting_bio_mood', weekNumber });
      ctx.reply('⌨️ Введите ваше Настроение (например, `Отличное` или прочерк):');
    }
    
    // 6. Awaiting Biometrics Step 3: Mood (End of Bio Flow)
    else if (state === 'awaiting_bio_mood') {
      const workout = getWorkout(userId, weekNumber);
      workout.biometrics.mood = userText;
      
      const newMarkdown = generateMarkdown(workout);
      updateWorkoutBiometrics(userId, weekNumber, workout.biometrics, newMarkdown);
      userStates.delete(userId);
      
      ctx.reply(`✅ *Показатели биометрии сохранены\\!*`, {
        parse_mode: 'MarkdownV2',
        reply_markup: new InlineKeyboard().text('📅 Перейти к неделе', `week:${weekNumber}`)
      });
    }
    
    // 7. Awaiting Raw MD text edit
    else if (state === 'awaiting_raw_md') {
      const parsed = parseMarkdown(userText);
      
      if (parsed.is_structured) {
        saveWorkout(
          userId, 
          parsed.week_number, 
          parsed.start_date, 
          parsed.title, 
          parsed.biometrics, 
          parsed.days_data, 
          userText
        );
        userStates.delete(userId);
        
        ctx.reply(`✅ *Файл успешно перезаписан и перепарсен\\!*`, {
          parse_mode: 'MarkdownV2',
          reply_markup: makeWeekKeyboard(parsed)
        });
      } else {
        ctx.reply('⚠️ Не удалось разобрать присланный Markdown. Убедитесь, что заголовки и YAML-разметка не повреждены, или отправьте `/start` для отмены.');
      }
    }
  } catch (error) {
    console.error('Error handling text dialog state:', error);
    ctx.reply('❌ Произошла ошибка при сохранении данных. Пожалуйста, напишите /start.');
    userStates.delete(userId);
  }
});

// Launching the bot
bot.catch((err) => {
  console.error('🚨 grammY bot encountered an error:', err);
});

console.log('🚀 Telegram Bot helper functions and events initialized successfully!');

if (process.env.NODE_ENV !== 'test') {
  bot.start({
    onStart: (botInfo) => {
      console.log(`🤖 Bot @${botInfo.username} started successfully in the background!`);
    }
  });
}
