var winston = require('winston');

var options = {
  from: new Date - 24 * 60 * 60 * 1000,
  until: new Date,
  limit: 10,
  start: 0,
  order: 'desc',
};

//
// Find items logged between today and yesterday.
//
winston.query(options, function (err, results) {
  if (err) {
    throw err;
  }

  console.log(results);
});
