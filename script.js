let compileButton = document.getElementById("compile-button");
let loadButton = document.getElementById("load-button");
let saveButton = document.getElementById("save-button");
let inputText = document.getElementById("input-text");
let outputText = document.getElementById("output-text");
let changedText = document.getElementById("changed-text");
let outputMessage = document.getElementById("output-message");

let keywords = {
  "cls" : "printchr$(147)",
  "bgd" : "poke53281,",
  "bor" : "poke53280,",
  "pen" : "poke646,",
  "black" : "0",
  "white" : "1",
  "red" : "2",
  "cyan" : "3",
  "purple" : "4",
  "green" : "5",
  "blue" : "6",
  "yellow" : "7",
  "orange" : "8",
  "brown" : "9",
  "pink" : "10",
  "grey_dark" : "11",
  "grey" : "12",
  "green_light" : "13",
  "blue_light" : "14",
  "grey_light" : "15"
}

function checkAlias(keyword)
{
  return keywords[keyword] || keyword;
}


let types = {
  VARIABLE : "VARIABLE",
  KEYWORD : "KEYWORD",
  OPERATOR : "OPERATOR",
  NUMBER : "NUMBER",
  STRING : "STRING",
  LABEL : "LABEL",
  SPACE : "SPACE",
  LINE_END : "LINE_END",
}

let seekingToken = true;
let currentTokenType = null;
let currentToken = "";
let tokens = [];
let labelMap = {};
let varMap = {};
let j = 0;
let labelCount = 0;
let varCount0 = 0;
let varCount1 = 0;

let prevLines = [];

function getLabelMap(label)
{
  let l = labelMap[label];
  if(l)
    return l;
  else {
    l = (labelMap[label] = "±" + (labelCount++) + "±");
    return l;
  }
}

let varChars = "zyxwvutsrqponmlkjihgfedcba";

function getVarMap(varLabel)
{
  let name = varMap[varLabel];
  if(name)
    return name;
  else {
    name = varChars.charAt(varCount1) + varChars.charAt(varCount0++);
    if(varCount0 > 25){
      varCount0 = 0;
      ++varCount1;
    }
    let type = varLabel.charAt(0)
    if(type != "#")
      name += type;
    varMap[varLabel] = name;
    return name;
  }
}

function getCharType(char)
{
    if(char.match(/[a-zA-Z_]/)){
      return types.KEYWORD;
    }
    if(char.match(/[\$\%\#]/)){
      return types.VARIABLE;
    }
    if(char.match(/[\+\-\=\<\>\/\*\(\)\,\:\;]/)){
      return types.OPERATOR;
    }
    if(char.match(/[0-9.]/)){
      return types.NUMBER;
    }
    if(char == '"'){
      return types.STRING;
    }
    if(char == '@'){
      return types.LABEL;
    }
    if(char == " "){
      return types.SPACE;
    }
    if(char == "\n"){
      return types.LINE_END;
    }
}

function getInitialCharType(char)
{
  let type = getCharType(char);
  switch(type)
  {
    case types.VARIABLE:
        currentTokenType = types.VARIABLE;
        currentToken += char;
    break;
    case types.KEYWORD:
        currentTokenType = types.KEYWORD;
        currentToken += char;
    break;
    case types.OPERATOR:
        currentTokenType = types.OPERATOR;
        currentToken += char;
    break;
    case types.NUMBER:
        currentTokenType = types.NUMBER;
        currentToken += char;
    break;
    case types.STRING:
        currentTokenType = types.STRING;
        //First char is just quotes, no need to add
    break;
    case types.LABEL:
        currentTokenType = types.LABEL;
    break;
    case types.SPACE:

      //Ignore, spaces outside of strings can be ignored
    break;

  }
}


function getTokenCharType(char)
{
  // console.log("Token is", currentTokenType, "char is", char, "token is", getCharType(char));
  let currentCharType = getCharType(char);

  switch (currentTokenType) {

    case types.KEYWORD:
      if(currentCharType == types.KEYWORD)
        currentToken += char;
      else {
        swallowToken();
        --j;
      }
      break;
    case types.STRING:
      if(currentCharType == types.STRING)
        swallowToken();
      else {
        currentToken += char;
      }
      break;
    case types.OPERATOR:
      swallowToken();
      break;
    case types.NUMBER:
      if(currentCharType != types.NUMBER)
      {
        swallowToken();
        --j;
      } else {
        currentToken += char;
      }
      break;
    case types.VARIABLE:
      if(currentCharType == types.KEYWORD || currentCharType == types.NUMBER)
      {
        currentToken += char;
      } else {
        swallowToken();
        --j;
      }
      break;
    case types.LABEL:
      if(currentCharType == types.KEYWORD || currentCharType == types.NUMBER)
      {
        currentToken += char;
      } else {
        swallowToken();
        --j;
      }
      break;

  }
}

function swallowToken()
{

  let token = {
    type : currentTokenType,
    value : currentToken
  }

  currentTokenType = null;
  currentToken = "";
  tokens.push(token);

}

function compile()
{
  let inputValue = inputText.value.replace(/[\t*]/g, "");
  let inputLines = inputValue.split("\n");

  let lineTokens = [];

  for(let i = 0; i < inputLines.length; ++i)
  {
    let line = inputLines[i];
    // --------------------------------------------------------------- TRIM COMMENTS AND DEAD LINES
    if(line.charAt(0) == "|")
    {
      inputLines.splice(i, 1);
      --i;
      continue;
    }
    if(line.match(/^ *$/))
    {
      inputLines.splice(i, 1);
      --i;
      continue;
    }

    inputLines[i] = line += "\n";//Add a terminating character
    tokens = [];
    currentTokenType = null;
    currentToken = "";
    labelMap = {};
    varMap = {};
    labelCount = 0;
    varCount0 = 0;
    varCount1 = 0;

    for(j = 0; j < line.length; ++j)
    {
      let char = line.charAt(j);
      if(currentTokenType == null)
        getInitialCharType(char);
      else
        getTokenCharType(char);
    }

    lineTokens.push(tokens);

  }

  // Now, we've got a set of tokenised lines...

  let l = lineTokens.length;

  for(let i = 0; i < l; ++i)
  {
    let line = lineTokens[i];

    let lineObject = {
      newLine : false
    };
    // If any lines start with a label, clear all other tokens from them and mark array as NEW_LINE = true
    if(line[0].type == types.LABEL){
      line = [line[0]];
      lineObject.labelLine = true;
    }
    if(line[0].value == "goto"){
      lineObject.gotoLine = true;
    }

    //SWAP ALL LABELS AND VARS

    for(j = 0; j < line.length; ++j)
    {
      let token = line[j];
      if(token.type == "VARIABLE")
        token.value = getVarMap(token.value);
      if(token.type == "LABEL")
        token.value = getLabelMap(token.value);
      if(token.type == "STRING")
        token.value = '"' + token.value + '"';
      if(token.type == "KEYWORD")
        token.value = checkAlias(token.value);
    }

    //Now, condense the tokens into a string
    let lineString = "";
    for(j = 0; j < line.length; ++j)
    {
      lineString += line[j].value;
    }

    lineObject.string = lineString;

    lineTokens[i] = lineObject;

  }

  //Now, the last thing we do is concatenate lines

  function pushAndReset()
  {
    finalLines.push(currentFinalLine);
    currentFinalLine = "";
  }

  let finalLines = [];
  let labelLineMap = {};

  let lineLength = 76;

  let currentFinalLine = "";

  for(let i = 0; i < lineTokens.length; ++i)
  {
    let line = lineTokens[i];
    let gotoLine = line.gotoLine;
    let labelLine = line.labelLine;
    let string = line.string;

    // If it's a newline command, it's a label, and can be mapped to the correct position
    if(labelLine)
    {
      pushAndReset();
      labelLineMap[string] = finalLines.length;
      continue;
    }
    if (gotoLine)
    {
      //This is a goto line
      pushAndReset();
      console.log("GOTO LINE", string);
    }

    if(currentFinalLine.length + string.length < lineLength)
    {
      currentFinalLine += ":" + string;
    } else {
      pushAndReset();
      currentFinalLine += string;
    }


  }

  //Put any remaining into the final array
  pushAndReset();



  for(let i = 0; i < finalLines.length; ++i)
  {
    let line = finalLines[i];
    if(line.charAt(0) == ":")
      line = line.substr(1);
    if(line.length == 0)
      line = "rem";

    for(let j in labelLineMap)
    {
      while(line.indexOf(j) != -1)
        line = line.replace(j, labelLineMap[j]);
    }

    finalLines[i] = i + line + "\n";

  }

  console.log("lines club", finalLines);

  let totalString = "new\n";
  let changedString = "";

  for(let i = 0; i < finalLines.length; ++i)
  {
    totalString += finalLines[i];

    if(finalLines[i] != prevLines[i])
      changedString += finalLines[i];
  }

  totalString += "run\n";
  changedString += "run\n";

  prevLines = finalLines.concat();

  outputText.value = totalString;
  changedText.value = changedString;
  changedText.select();
  document.execCommand("copy");

  //
  // let finalString = "new\n";
  //
  // for(let i = 0; i < finalLines.length; ++i)
  // {
  //   let line = finalLines[i];
  //   if(line.charAt(0) == ":")
  //     line = line.substr(1);
  //
  //   for(let j in labelLineMap)
  //   {
  //     while(line.indexOf(j) != -1)
  //       line = line.replace(j, labelLineMap[j]);
  //   }
  //
  //   finalLines[i] = line;
  //   if(line.length == 0)
  //     line = "rem";
  //
  //   finalString += i + line + "\n";
  // }
  //
  // finalString += "run\n";
  //
  // outputText.value = finalString;
  // outputText.select();
  // document.execCommand("copy");


}

//SET UP TAB
var textareas = document.getElementsByTagName('textarea');
var count = textareas.length;
for(var i=0;i<count;i++){
    textareas[i].onkeydown = function(e){
        if(e.keyCode==9 || e.which==9){
            e.preventDefault();
            var s = this.selectionStart;
            this.value = this.value.substring(0,this.selectionStart) + "\t" + this.value.substring(this.selectionEnd);
            this.selectionEnd = s+1;
        }
    }
}


compileButton.addEventListener("click", compile);
window.addEventListener("keydown", (e)=>{
  if(e.keyCode == 192){
    e.preventDefault();
    e.stopImmediatePropagation();
    compile();
  }
});

loadWarn = false;
saveWarn = false;

loadButton.addEventListener("click", function(){
  if(loadWarn){
    inputText.value = localStorage.getItem("code");
  } else {
    loadWarn = true;
    loadButton.style.background = "#f00";
    setTimeout(function(){
      loadWarn = false;
      loadButton.style.background = "#aaa";
    }, 1000);
  }
});

saveButton.addEventListener("click", function(){
  if(saveWarn){
    localStorage.setItem("code", inputText.value);
  } else {
    saveWarn = true;
    saveButton.style.background = "#f00";
    setTimeout(function(){
      saveWarn = false;
      saveButton.style.background = "#aaa";
    }, 1000);
  }

});
