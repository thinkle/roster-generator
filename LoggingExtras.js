VERBOSITY = 3

function doLog (verbosity, s) {
  if (VERBOSITY >= verbosity) {
    Logger.log(s)
  }
}

logVerbose = function (s) {doLog(5,s)}
logNormal = function (s) {doLog(1,s)}
logAlways = function (s) {doLog(-1,s)}