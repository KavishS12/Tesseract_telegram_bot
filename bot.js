const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

app.post('/', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = 'API-TOKEN';
const bot = new TelegramBot(token);

//Handle the root route

app.get('/', (req, res) => {
  res.send('Bot is up and running!');
});

const questions = [
  { id: 1, question: "question1", answer: "answer1", image: "./images/q1.jpg", hint: "hint1" },
  { id: 2, question: "question2", answer: "answer2", image: "./images/q2.jpg", hint: "hint2" },
  { id: 3, question: "question3", answer: "answer3", image: "./images/q3.jpg", hint: "hint3" },
  { id: 4, question: "question4", answer: "answer4", image: "./images/q4.jpg", hint: "hint4" },
  { id: 5, question: "question5", answer: "answer5", image: "./images/q5.jpg", hint: "hint5" },
  { id: 6, question: "question6", answer: "answer6", image: "./images/q6.jpg", hint: "hint6" },
  { id: 7, question: "question7", answer: "answer7", image: "./images/q7.jpg", hint: "hint7" },
  { id: 8, question: "question8", answer: "answer8", image: "./images/q8.jpg", hint: "hint8" },
  { id: 9, question: "question9", answer: "answer9", image: "./images/q9.jpg", hint: "hint9" },
  { id: 10, question: "question10", answer: "answer10", image: "./images/q10.jpg", hint: "hint10" },
  { id: 11, question: "question11", answer: "answer11", image: "./images/q11.jpg", hint: "hint11" },
  { id: 12, question: "question12", answer: "answer12", image: "./images/q12.jpg", hint: "hint12" }
];

const teamIDs = [
  10324, 10754, 10773, 11185, 11280, 10832, 11627, 11444, 11166, 10830, 
  10156, 11016, 11196, 11688, 11068, 10666, 11015, 10865, 10568, 11497, 
  11742, 10483, 11667, 10739, 10425, 11128, 11002, 11565, 10651, 10003, 
  10632, 10729, 11620, 10007, 10415, 11121, 10816, 11743, 10244, 11069, 
  10139, 11506, 10731, 11086, 11201, 10046, 10916, 10527, 10878, 11732, 
  11490, 11532, 10366, 11228, 10362, 10218, 11718, 10604, 11268, 11518, 
  11469, 10400, 10283, 10247, 10261
];

const teamIDs_registered = []

const userStates = {}; // Store user progress, scores, unanswered questions
const timers = {}; // Store timers for each user

async function initializeUser(chatId) {
  userStates[chatId] = {
    started : false,
    teamId : null,
    score: 0,
    answered: new Set(),
    currentQuestionIndex: 0,
    hints_used : new Set(),
    hint_active : Array(12).fill(false),
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
    userStates[chatId].hint_active[questionIndex] = true //activate hint after 1.5 min on sending question
  },90000)
}

function scheduleAllQuestions(chatId) {
  const questionIntervals = [3, 6, 9 , 12, 15, 18, 21, 24, 27, 30, 33]; // Send questions at these minute intervals
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
              bot.sendMessage(chatId, `Congratulations! You answered all questions correctly!\n\nTimestamped logged for Team Id ${Number(String(user.teamId).slice(0, 5))}`);
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
  if(teamIDs_registered.includes(teamId)){
    bot.sendMessage(chatId,"Team Id already present in the game.");
    return;
  }
  user.started = true;
  user.teamId = teamId;
  teamIDs_registered.push(teamId);
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
  response += `\n\nNumber of hints used : ${user.hints_used.size}`;
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
    bot.sendMessage(chatId,"/help : Command panel\n/start : User registration\n/tesseract_teamID : Begin the game\n/dashboard : Get your current score and progress\n/hint_x : Get hint for question number 'x'");
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
  } else if(!user.hints_used.has(questionId) && user.hints_used.size >= 4) {
    bot.sendMessage(chatId, `No more hints available!!!`);
    return;
  } 
  hint = questions[questionIndex].hint
  user.hints_used.add(questionId);
  bot.sendMessage(chatId, `Hint for question ${questionId} : ${hint}\n\nNumber of hints used : ${user.hints_used.size}`);
});


const { google } = require('googleapis');
const moment = require('moment-timezone');

const SHEET_ID = 'GOOGLE-SHEET-Id';
//get credentials path i.e. json file downloaded when key created for service account in google cloud console
const CREDENTIALS_PATH = 'credentials.json';

const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const logTimestamp = async (chatId) => {
  const user = userStates[chatId];
  if (!user) return;

  const timestamp = moment().tz('Asia/Kolkata').format('HH:mm:ss');
  let tId = Number(String(user.teamId).slice(0, 5));
  const values = [
    [tId, timestamp],
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
  } catch (error) {
    console.error('Error logging timestamp:', error);
  }
};

// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId,"Server inactive currently");
// });

// // Handle the root route
// app.get('/', (req, res) => {
//   res.send('Server inactive!');
// });
