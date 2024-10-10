const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Replace with your Bot Token from BotFather
const token = '7787784256:AAH98vvyecRZFtmxeGHC8RB4hWqHoSCJn04';
const bot = new TelegramBot(token, { polling: true });

const questions = [
  { id: 1, question: "Question 1", answer: "Ans1", image: "./images/img1.png", hint: "Hint 1" },
  { id: 2, question: "Question 2", answer: "Ans2", image: "./images/img2.png", hint: "Hint 2" },
  { id: 3, question: "Question 3", answer: "Ans3", image: "./images/img3.png", hint: "Hint 3" },
  { id: 4, question: "Question 4", answer: "Ans4", image: "./images/img4.png", hint: "Hint 4" },
  { id: 5, question: "Question 5", answer: "Ans5", image: "./images/img5.png", hint: "Hint 5" },
];

const teamIDs = [1234,5678,2345,9999,1111,3322]

const userStates = {}; // Store user progress, scores, unanswered questions
const timers = {}; // Store timers for each user

async function initializeUser(chatId) {
  userStates[chatId] = {
    started : false,
    teamId : null,
    score: 0,
    answered: new Set(),
    currentQuestionIndex: 0,
    hint_count : 0,
    hint_active : Array(5).fill(false),
    startTime: Date.now(),
  }; 
}

async function sendQuestion(chatId, questionIndex) {
  const question = questions[questionIndex];
  // Send the local image
  if (question.image) {
    await bot.sendPhoto(chatId, fs.createReadStream(question.image));
  }
  await bot.sendMessage(chatId, `Question ${question.id}: ${question.question}`);
  setTimeout(()=>{
    userStates[chatId].hint_active[questionIndex] = true
  },60000/2)
}

function scheduleAllQuestions(chatId) {
  const questionIntervals = [3, 6, 9 ,12].map((i)=>i/3); // Send questions at these minute intervals
  questionIntervals.forEach((interval, index) => {
    const questionIndex = index + 1; // First question already sent
    const delay = interval * 60000; // Convert minutes to milliseconds

    timers[chatId] = setTimeout(() => {
      const user = userStates[chatId];

      // If question sent already(all previous questions up to this point are answered),skip this timeout
      if (user.currentQuestionIndex >= questionIndex) return;

      // If question not sent till now(unanswered questions exist), send the next scheduled question
      sendQuestion(chatId, questionIndex);
      user.currentQuestionIndex += 1;
    }, delay);
  });
}

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const user = userStates[chatId];
  const userAnswer = msg.text;
  
  if(!userAnswer.startsWith("/") && user && user.started){
    const [questionId, answer] = userAnswer.split(":").map(s => s.trim());

    if (questionId && answer) {
      const questionIndex = questions.findIndex(q => q.id === parseInt(questionId));
      if (questionIndex !== -1 && questionIndex <= userStates[chatId].currentQuestionIndex) {
        const question = questions[questionIndex];

        // Check if the question has already been answered
        if (user.answered.has(parseInt(questionId))) {
          bot.sendMessage(chatId, `You've already answered question ${questionId}.`);
          return;
        }

        // Check if the user's answer is correct
        if (answer.toLowerCase() === question.answer.toLowerCase()) {
          bot.sendMessage(chatId, `Correct answer for question ${questionId}!`);

          // Update score and mark question as answered
          user.answered.add(parseInt(questionId));
          user.score += 1;

          // Check if all previous questions are answered
          if (user.answered.size === user.currentQuestionIndex+1) {
            const nextQuestionIndex = user.currentQuestionIndex + 1;

            // Send the next question immediately if it is available
            if (nextQuestionIndex < questions.length) {
              setTimeout(()=>{
                sendQuestion(chatId, nextQuestionIndex);
                user.currentQuestionIndex = nextQuestionIndex; // Update current index
              },500)
            }
          }

          // Check if the user has answered all questions
          if (user.score === questions.length) {
            logTimestamp(chatId);
            setTimeout(()=>{
              bot.sendMessage(chatId, `Congratulations! You answered all questions correctly!\n\nTimestamped logged for Team Id ${user.teamId}`);
              clearTimers(chatId); // Stop any pending timers
            },1000)
          }
        } else {
          bot.sendMessage(chatId, `Incorrect answer for question ${questionId}. Try again!`);
        }
      } else if(questionIndex === -1) {
        bot.sendMessage(chatId, `Question ${questionId} doesn't exist! Please check the question number.`);
      } else if(questionIndex > userStates[chatId].currentQuestionIndex) {
        bot.sendMessage(chatId, `Question ${questionId} has not been activated yet!`);
      }
    } else {
      bot.sendMessage(chatId, "Please provide your answer in the format 'question_number: your_answer'.");
    }
  } else if(userAnswer.startsWith("/")){
    if(!['/start','/help','/dashboard'].includes(userAnswer) && !/^\/hint_\d+$/.test(userAnswer) && !/^\/tesseract_\d+$/.test(userAnswer)) {
      bot.sendMessage(chatId, "Command does not exist!");
    }
  } else if(!userAnswer.startsWith("/") && !user){
    bot.sendMessage(chatId, "Type '/start' to register yourself first!");
  } else if(!userAnswer.startsWith("/") && !user.started) {
    bot.sendMessage(chatId,"You haven't started the quiz yet .Type '/tesseract_teamID to begin.")
  }
});

// Clear timers when the quiz is finished or reset
function clearTimers(chatId) {
  if (timers[chatId]) {
    clearTimeout(timers[chatId]);
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if(chatId in userStates){
    bot.sendMessage(chatId,"Already registered!")
    return;
  }
  bot.sendMessage(chatId,"Welcome to Tesseract! \nYou are now registered .Type '/tesseract_teamID to begin the game");
  initializeUser(chatId);
});

bot.onText(/\/tesseract_(\d+)/, (msg,match) => {
  const chatId = msg.chat.id;
  const user = userStates[chatId];
  if(!user) {
    bot.sendMessage(chatId,"Type '/start' to register yourself first!");
    return;
  }
  if(user.started){
    bot.sendMessage(chatId,"Game has already started!")
    return;
  }
  const teamId = parseInt(match[1]);
  if(!teamIDs.includes(teamId)){
    bot.sendMessage(chatId,"Team Id not valid.");
    return;
  }
  user.started = true;
  user.teamId = teamId;
  bot.sendMessage(chatId,"Game started!");
  setTimeout(()=>{
    // Send the first question
    sendQuestion(chatId, 0);
    // Schedule the remaining questions at their designated times
    scheduleAllQuestions(chatId);
  },500) 
});

const displayDashboard = (chatId,user) => {
  const score = user.score;
  const answeredQuestions = [...user.answered];
  let response = `Current score : ${score}\n\nCorrectly answered questions:`;
  if (answeredQuestions.length > 0) {
    answeredQuestions.forEach((id) => {
      response += `${id}\t`;
    });
  } else {
    response += "You haven't answered any questions yet.";
  }
  response += `\n\nNumber of hints used : ${user.hint_count}`
  bot.sendMessage(chatId, response);
} 

bot.onText(/\/dashboard/, (msg) => {
  const chatId = msg.chat.id;
  const user = userStates[chatId];

  if (!user){
    bot.sendMessage(chatId, "Type '/start' to register yourself first!");
    return;
  } else if (!user.started){
    bot.sendMessage(chatId, "You haven't started the quiz yet. Type '/tesseract_teamID to begin.");
    return;
  }
  displayDashboard(chatId,user);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
    bot.sendMessage(chatId,"/help : Command panel\n/start : User registration\n/tesseract_(teamID) : Begin the game\n/dashboard : Get your current score and progress\n/hint_x : Get hint for question number 'x'");
});

bot.onText(/\/hint_(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const user = userStates[chatId];
  if (!user){
    bot.sendMessage(chatId, "Type '/start' to register yourself first!");
    return;
  } else if (!user.started){
    bot.sendMessage(chatId, "You haven't started the quiz yet. Type '/tesseract_teamID to begin.");
    return;
  }
  const questionId = parseInt(match[1]);
  const questionIndex = questions.findIndex(q => q.id === parseInt(questionId));
  if(questionIndex === -1) {
    bot.sendMessage(chatId, `Question ${questionId} doesn't exist! Please check the question number.`);
    return;
  } else if(questionIndex > user.currentQuestionIndex) {
    bot.sendMessage(chatId, `Question ${questionId} has not been activated yet!`);
    return;
  } else if (user.answered.has(questionId)) {
    bot.sendMessage(chatId, `You've already answered question ${questionId}.`);
    return;
  }else if(user.hint_active[questionIndex] == false) {
    bot.sendMessage(chatId, `Hint ${questionId} has not been activated yet!`);
    return;
  } else if(user.hint_count >= 2) {
    bot.sendMessage(chatId, `No more hints available!!!`);
    return;
  } 
  hint = questions[questionIndex].hint
  user.hint_count += 1;
  bot.sendMessage(chatId, `Hint for question ${questionId} :\n ${hint}\n\n Number of hints used : ${user.hint_count}`);
});


const { google } = require('googleapis');
const moment = require('moment-timezone');

const SHEET_ID = '1T5rk7vraQH_3uwivftgZlq3fFKF2dw1onfSB9kXMH0s';
const CREDENTIALS_PATH = 'fiery-chess-438220-e8-f338a6415af6.json';

const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const logTimestamp = async (chatId) => {
  const user = userStates[chatId];
  if (!user) return;

  const timestamp = moment().tz('Asia/Kolkata').format('HH:mm:ss');

  const values = [
    [user.teamId, timestamp],
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:B', 
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: values,
      },
    });
    console.log(`Timestamp for Team ID ${user.teamId} logged successfully.`);
  } catch (error) {
    console.error('Error logging timestamp:', error);
  }
};

// const xlsx = require('xlsx');
// const moment = require('moment-timezone');
// const excelFilePath = './completion_timestamps.xlsx';
// const preferredTimezone = 'Asia/Kolkata';

// // Initialize the Excel sheet if it doesn't exist
// if (!fs.existsSync(excelFilePath)) {
//   const workbook = xlsx.utils.book_new();
//   const worksheet = xlsx.utils.json_to_sheet([]);
//   xlsx.utils.book_append_sheet(workbook, worksheet, 'Timestamps');
//   xlsx.writeFile(workbook, excelFilePath);
// }

// // Function to log user timestamp
// const logTimestamp = (chatId) => {
//   const workbook = xlsx.readFile(excelFilePath);
//   const worksheet = workbook.Sheets['Timestamps'];
//   // Get current time in preferred timezone, formatted as HH:mm:ss
//   const timestamp = moment().tz(preferredTimezone).format('HH:mm:ss');
//   // Append a new row for the user
//   const newRow = {
//     'Team ID': userStates[chatId].teamId,
//     'Completion Time': timestamp,
//   };
//   // Get existing data from the sheet and add new row
//   const data = xlsx.utils.sheet_to_json(worksheet);
//   data.push(newRow);
//   // Convert back to worksheet and save the file
//   const newSheet = xlsx.utils.json_to_sheet(data);
//   workbook.Sheets['Timestamps'] = newSheet;
//   xlsx.writeFile(workbook, excelFilePath);
// };
