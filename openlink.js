const queryString = window.location.search;
console.log("queryString: " + queryString);
// https://iammcse.github.io/openlink.js
// https://booking.kscgolf.org.hk/?morningParam=0&afternoonParam=0&serverParam=my5600x&offset=0
const urlParams = new URLSearchParams(queryString);
const serverParam = urlParams.get("serverParam");
console.log('serverParam: ' + serverParam);
const morningParam = urlParams.get("morningParam");
console.log('morningParam: ' + morningParam);
const afternoonParam = urlParams.get("afternoonParam");
console.log('afternoonParam: ' + afternoonParam);

let offset = urlParams.get("offset");

//let offset = 0;
if (offset == null || offset == "" ){
  
  offset = 0; 

}
console.log('offset: ' + offset);

//https://kscgolf2.noq.com.hk/?noq_c=kscgolf&noq_r=https%3A%2F%2Fbooking.kscgolf.org.hk%2FwaitingRoom
//const ksc_URL = "https://booking.kscgolf.org.hk/waitingRoom";

//7 numbers specify [year], [month], [day], [hour], [minute], [second], and [millisecond] (in that order)
const today = new Date();
const morningSession = new Date(today.getFullYear(),today.getMonth(),today.getDate(),9,30,0,0);
const afternoonSession = new Date(today.getFullYear(),today.getMonth(),today.getDate(),17,0,0,0);
const midnight = new Date(today.getFullYear(),today.getMonth(),today.getDate(),23,59,59,999);
// set number of seconds before launch

var offsetMilliSecondsValue = "0" ;
var afternoon_offsetMilliSecondsValue = "0" ;

const currentServer = {morning: 0, afternoon: 0};


const KServer01 = {morning: 760, afternoon: 760}; 
const KServer02 = {morning: 760, afternoon: 760}; 
const KServer03 = {morning: 760, afternoon: 760}; 
const KServer04 = {morning: 760, afternoon: 760}; 
const KServer05 = {morning: 760, afternoon: 760}; 
const KServer06 = {morning: 760, afternoon: 760}; 
const KServer07 = {morning: 760, afternoon: 760}; 
const KServer08 = {morning: 760, afternoon: 760}; 
const KServer09 = {morning: 760, afternoon: 760}; 
const KServer10 = {morning: 760, afternoon: 760}; 
const KServer11 = {morning: 760, afternoon: 760}; 
const KServer12 = {morning: 760, afternoon: 760}; 
const KServer13 = {morning: 760, afternoon: 760}; 
const KServer14 = {morning: 760, afternoon: 760}; 
const KServer15 = {morning: 760, afternoon: 760}; 
const KServer16 = {morning: 760, afternoon: 760};

const my5600x = {morning: 160, afternoon: 760};
const win7ssd = {morning: 860, afternoon: 860};
const edge = {morning: 1160, afternoon: 760}; 
const brave = {morning: 960, afternoon:760}; 
const Wildcard = {morning: 1160, afternoon: 760};
const AllBraveKservers = {morning: 2932, afternoon: 639};  

switch(serverParam) {
  case "KServer01":
    currentServer.morning = KServer01.morning ;
    currentServer.afternoon = KServer01.afternoon;
    document.title = "KS01";
    console.log("switching KServer01");
      break;
  case "KServer02":
    currentServer.morning = KServer02.morning ;
    currentServer.afternoon = KServer02.afternoon;
    document.title = "KS02";
    console.log("switching KServer02");
    break;
  case "KServer03":
    currentServer.morning = KServer03.morning ;
    currentServer.afternoon = KServer03.afternoon;
    document.title = "KS03";
    console.log("switching KServer03");
  break;
  case "KServer04":
    currentServer.morning = KServer04.morning ;
    currentServer.afternoon = KServer04.afternoon;
    document.title = "KS04";
    console.log("switching KServer04");
  break;
  case "KServer05":
    currentServer.morning = KServer05.morning ;
    currentServer.afternoon = KServer05.afternoon;
    document.title = "KS05";
    console.log("switching KServer05");
  break;
  case "KServer06":
    currentServer.morning = KServer06.morning ;
    currentServer.afternoon = KServer06.afternoon;
    document.title = "KS06";
    console.log("switching KServer06");
  break;
  case "KServer07":
    currentServer.morning = KServer07.morning ;
    currentServer.afternoon = KServer07.afternoon;
    document.title = "KS07";
    console.log("switching KServer07");
  break;
  case "KServer08":
    currentServer.morning = KServer08.morning ;
    currentServer.afternoon = KServer08.afternoon;
    document.title = "KS08";
    console.log("switching KServer08");
  break;
  case "KServer09":
    currentServer.morning = KServer09.morning ;
    currentServer.afternoon = KServer09.afternoon;
    document.title = "KS09";
    console.log("switching KServer09");
  break;
  case "KServer10":
    currentServer.morning = KServer10.morning ;
    currentServer.afternoon = KServer10.afternoon;
    document.title = "KS10";
    console.log("switching KServer10");
  break;
  case "KServer11":
    currentServer.morning = KServer11.morning ;
    currentServer.afternoon = KServer11.afternoon;
    document.title = "KS11";
    console.log("switching KServer11");
  break;
  case "KServer12":
    currentServer.morning = KServer12.morning ;
    currentServer.afternoon = KServer12.afternoon;
    document.title = "KS12";
    console.log("switching KServer12");
  break;
  case "KServer13":
    currentServer.morning = KServer13.morning ;
    currentServer.afternoon = KServer13.afternoon;
    document.title = "KS13";
    console.log("switching KServer13");
  break;
  case "KServer14":
    currentServer.morning = KServer14.morning ;
    currentServer.afternoon = KServer14.afternoon;
    document.title = "KS14";
    console.log("switching KServer14");
  break;
  case "KServer15":
    currentServer.morning = KServer15.morning ;
    currentServer.afternoon = KServer15.afternoon;
    document.title = "KS15";
    console.log("switching KServer15");
  break;
  case "KServer16":
    currentServer.morning = KServer16.morning ;
    currentServer.afternoon = KServer16.afternoon;
    document.title = "KS16";
    console.log("switching KServer16");
  break;
  case "win7ssd":
    currentServer.morning = win7ssd.morning ;
    currentServer.afternoon = win7ssd.afternoon;
    document.title = "win7ssd";
    console.log("switching win7ssd");
  break;
  case "my5600x":
    currentServer.morning = my5600x.morning ;
    currentServer.afternoon = my5600x.afternoon;
    document.title = "my5600x";
    console.log("switching my5600x");
  break;
  case "edge":
    currentServer.morning = edge.morning ;
    currentServer.afternoon = edge.afternoon;
    document.title = "edge";
    console.log("switching edge");
  break;
  case "brave":
    currentServer.morning = brave.morning ;
    currentServer.afternoon = brave.afternoon;
    document.title = "brave";
    console.log("switching brave");
  break;
  case "AllBraveKservers":
    currentServer.morning = AllBraveKservers.morning ;
    currentServer.afternoon = AllBraveKservers.afternoon;
    document.title = "AllBraveKservers";
    console.log("switching AllBraveKservers");
  break;
  case "Wildcard":
    currentServer.morning = Wildcard.morning ;
    currentServer.afternoon = Wildcard.afternoon;
    document.title = "Wildcard";
    console.log("switching Wildcard");
  break;
  default:
  currentServer.morning = 0;
  currentServer.afternoon = 0;
  console.log("switching to Default");
}



if (morningParam !== null && morningParam !== "" && morningParam !== "0"){
   offsetMilliSecondsValue = Number(morningParam) + Number(offset); // Morning from Param 
   console.log("morningParam is NOT empty");
   console.log("morningParam: " + morningParam + " offset: " + offset);
}else{
   offsetMilliSecondsValue = Number(currentServer.morning) + Number(offset); // Morning default
   console.log("morningParam is empty");
   console.log("morningParam: " + currentServer.morning + " offset: " + offset);
}

if (afternoonParam !== null && afternoonParam !== "" && afternoonParam !== "0"){
   afternoon_offsetMilliSecondsValue =Number(afternoonParam) + Number(offset); // afternoon from Param
   console.log("afternoonParam is NOT Empty");
   console.log("afternoonParam: " + afternoonParam + " offset: " + offset);
}
else{
   afternoon_offsetMilliSecondsValue = Number(currentServer.afternoon) + Number(offset); // afternoon default
   console.log("afternoonParam is Empty");
   console.log("afternoonParam: " + currentServer.afternoon + " offset: " + offset);
}

console.log("offsetMilliSecondsValue: " + offsetMilliSecondsValue ); 

  // Get today's date and time 
  var now = new Date();
  var setHour = 0;
  var setMinute =0;
  var myInputTime = new Date();

  if (now.getTime() > morningSession.getTime() && now.getTime() <= afternoonSession.getTime() )    {
    myInputTime = afternoonSession - afternoon_offsetMilliSecondsValue;
    //console.log("myInputTime is : " + myInputTime);
  }
  else if (now.getTime() > afternoonSession && now.getTime() <= midnight) 
      {
      myInputTime = morningSession - offsetMilliSecondsValue + (1000 * 60 * 60 * 24);      
      console.log(myInputTime);
      //alert("midnight");
      }
  else  {myInputTime = morningSession - offsetMilliSecondsValue;}
  
 

// Set the date we're counting down to
//var countDownDate = new Date(myInputTime).getTime()
  var countDownDate = myInputTime;
// Find the subtractMilliSecondsValue between now and the count down date
  var subtractMilliSecondsValue = countDownDate - now.getTime();
  

// https://stackoverflow.com/questions/902713/how-do-i-programmatically-click-a-link-with-javascript
  
// var link ="https://booking.kscgolf.org.hk/waitingRoom";

  // function clickLink(link) {
  //       var cancelled = false;

  //       if (document.createEvent) {
  //           var event = document.createEvent("MouseEvents");
  //           event.initMouseEvent("click", true, true, window,
  //               0, 0, 0, 0, 0,
  //               false, false, false, false,
  //               0, null);
  //           cancelled = !link.dispatchEvent(event);
  //       }
  //       else if (link.fireEvent) {
  //           cancelled = !link.fireEvent("onclick");
  //       }

  //       if (!cancelled) {
  //           window.location = link.href;
  //       }
  //   }


   
   //setTimeout(timeToOpen, subtractMilliSecondsValue);
   //setTimeout(clickLink(link), subtractMilliSecondsValue);


console.log(subtractMilliSecondsValue);


function startTime() {
  var xPathRes = document.evaluate ('//*[@id="root"]/div[2]/div[2]/div/div/div[2]/a', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  xPathRes.singleNodeValue.click();
  
}
//setTimeout(function() {startTime()}, 3000);
setTimeout(function() {startTime()}, subtractMilliSecondsValue);


// DISPLAY ------------------------------------------------------------

//var displayTarget = new Date(myInputTime);
//console.log("displayTarget is : " + myInputTime);
//document.title = displayTarget.toDateString() ;

var displayTarget = new Date(myInputTime);
console.log("displayTarget is : " + myInputTime);
var titleDate = displayTarget.toLocaleTimeString("en-US", { hour12: false }) + " (" + displayTarget.getMilliseconds() + "mi)";

// Update the count down every 1/2 second

var x = setInterval(function() {

   // Get today's date and time
   var nowUpdated = new Date().getTime();
    
    // Find the subtractMilliSecondsValue between now and the count down date
    var distance = countDownDate - nowUpdated;

  // Time calculations for days, hours, minutes and seconds
  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((distance % (1000 * 60)) / 1000);
  var milliseconds = distance % 1000;
    
  // Output the result in an element with id="Canvas"
  document.title = hours + "h" + minutes + "m" + seconds + "s " + titleDate;
  //+ milliseconds +"ms"
    
  // If the count down is over, write some text 
  if (distance < 0) {
    clearInterval(x);
    document.title = "EXPIRED";
  }
}, 250);