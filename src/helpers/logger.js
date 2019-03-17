const bunyan = require('bunyan');
const bsyslog = require('bunyan-syslog');

/**
 * A logger responsible for the following:
 *
 * - Outputting to console (DEBUG and up)
 * - Outputting to a file that rotates daily (INFO and up)
 * - IN PRODUCTION, outputting to Papertrail (INFO and up)
 *
 * Notes:
 * - Specify a `req_id` when logging to help tie logged messages by invocations of the various
 *   bot commands (e.g. logger.info({ req_id: message.id }, 'Something happened'); )
 */

const logger = bunyan.createLogger({
  name: 'gdnbot2',
  serializers: {
    err: bunyan.stdSerializers.err
  },
  streams: [
    {
      type: 'stream',
      level: bunyan.INFO,
      stream: process.stdout
    },
    {
      type: 'rotating-file',
      level: bunyan.DEBUG,
      path: `${process.env.PWD}/src/gdnbot2.log`,
      period: '1d',
      count: 3
    }
  ]
});

logger.on('error', (err, stream) => {
  console.error('an error occurred in the logger:', err);
});

/**
 * A helper method to generate an object that can be used to tag logged messages generated from
 * a singular "request". This will help with troubleshooting sequences events by allowing for
 * filtering on this particular, consistent ID.
 *
 * @param {string|number} id - Typically `message.id`
 * @returns {object}
 */
logger.getLogTag = (id) => ({ req_id: id });

if (process.env.NODE_ENV === 'production') {
  // Add a Papertrail stream
  logger.addStream({
    type: 'raw',
    level: bunyan.DEBUG,
    stream: bsyslog.createBunyanStream({
      type: 'udp',
      facility: bsyslog.local0,
      host: process.env.PAPERTRAIL_HOST,
      port: parseInt(process.env.PAPERTRAIL_PORT, 10)
    })
  });
}

module.exports = logger;
