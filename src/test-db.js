import {
  saveUser,
  saveWorkout,
  getWorkoutsForUser,
  getWorkout,
  updateWorkoutBiometrics,
  updateWorkoutDays
} from './db.js';
import fs from 'node:fs';

// Temporary clean data folder for tests
process.env.DATABASE_PATH = 'data/test-workout.db';

// Clean up previous test db if exists
if (fs.existsSync('data/test-workout.db')) {
  fs.unlinkSync('data/test-workout.db');
}

console.log('--- Database Verification Script ---');

try {
  // 1. Test saveUser
  console.log('1. Testing saveUser...');
  saveUser(12345, 'ivanov', 'Иван');
  console.log('✅ User saved.');

  // 2. Test saveWorkout
  console.log('2. Testing saveWorkout...');
  const mockBiometrics = { weight: 75.2, sleep: '7h', mood: 'Good' };
  const mockDaysData = [
    {
      day: 'Пн',
      date: '18.05',
      type: 'Upper Power',
      diet: 'MODERATE CARB',
      exercises: [
        {
          id: 1,
          name: 'Жим лежа',
          params: '55.0 кг, 2 x 8',
          rpe: '8',
          comment: 'Тяжело шло'
        }
      ]
    }
  ];
  const mockMarkdown = 'mock markdown content';
  
  const insertId = saveWorkout(12345, 21, '2026-05-18', '# Week 21', mockBiometrics, mockDaysData, mockMarkdown);
  console.log(`✅ Workout saved. Row ID: ${insertId}`);

  // 3. Test getWorkoutsForUser
  console.log('3. Testing getWorkoutsForUser...');
  const list = getWorkoutsForUser(12345);
  console.log('List retrieved:', list);
  if (list.length !== 1 || list[0].week_number !== 21) {
    throw new Error('getWorkoutsForUser failed');
  }
  console.log('✅ getWorkoutsForUser matches.');

  // 4. Test getWorkout
  console.log('4. Testing getWorkout...');
  const workout = getWorkout(12345, 21);
  console.log('Workout retrieved:', workout);
  if (workout.week_number !== 21 || workout.biometrics.weight !== 75.2 || workout.days_data[0].exercises[0].name !== 'Жим лежа') {
    throw new Error('getWorkout fields don\'t match');
  }
  console.log('✅ getWorkout is correct.');

  // 5. Test updateWorkoutBiometrics
  console.log('5. Testing updateWorkoutBiometrics...');
  const updatedBiometrics = { weight: 74.8, sleep: '8h', mood: 'Great' };
  updateWorkoutBiometrics(12345, 21, updatedBiometrics, 'updated markdown');
  
  const workoutAfterBio = getWorkout(12345, 21);
  console.log('Workout after bio update:', workoutAfterBio);
  if (workoutAfterBio.biometrics.weight !== 74.8 || workoutAfterBio.raw_markdown !== 'updated markdown') {
    throw new Error('updateWorkoutBiometrics failed');
  }
  console.log('✅ updateWorkoutBiometrics correct.');

  // 6. Test updateWorkoutDays
  console.log('6. Testing updateWorkoutDays...');
  const updatedDays = [
    {
      day: 'Пн',
      date: '18.05',
      type: 'Upper Power',
      diet: 'MODERATE CARB',
      exercises: [
        {
          id: 1,
          name: 'Жим лежа',
          params: '55.0 кг, 2 x 8',
          rpe: '9',
          comment: 'Поставили RPE = 9'
        }
      ]
    }
  ];
  updateWorkoutDays(12345, 21, updatedDays, 'markdown with new days');
  
  const workoutAfterDays = getWorkout(12345, 21);
  console.log('Workout after days update:', workoutAfterDays);
  if (workoutAfterDays.days_data[0].exercises[0].rpe !== '9' || workoutAfterDays.days_data[0].exercises[0].comment !== 'Поставили RPE = 9') {
    throw new Error('updateWorkoutDays failed');
  }
  console.log('✅ updateWorkoutDays correct.');

  console.log('\n⭐⭐⭐ ALL DATABASE TESTS PASSED SUCCESSFULLY! ⭐⭐⭐');

} catch (error) {
  console.error('❌ Database test failed:', error);
  process.exit(1);
} finally {
  // Clean up
  if (fs.existsSync('data/test-workout.db')) {
    fs.unlinkSync('data/test-workout.db');
  }
}
