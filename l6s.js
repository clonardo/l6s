const chalk = require('chalk');
const { Command } = require('commander');
const program = new Command();

const { getCsvDiff } = require('./lib/file-handling');
program
  .option(
    '-o, --orig <path>',
    'Full or relative path to the original/older file',
    `./fixtures/orig.csv`
  )
  .option(
    '-u, --updated <path>',
    'Full or relative path to the updated/newer file',
    `./fixtures/updated.csv`
  )
  .option(
    '-h, --header <path>',
    'Name of target header column in both original and updated CSVs.',
    `id`
  )
  .configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name() // Just show the name, instead of short usage.
  });

const rawOpts = program.parse().opts() || {};
const { orig, updated, header } = rawOpts;
if (orig && updated && header) {
  console.log(
    `
    Beginning diff. [old: ${chalk
      .rgb(255, 0, 0)
      .bold.bgYellow(` ${orig} `)}, vs. updated: ${chalk
      .rgb(22, 22, 22)
      .bold.bgGreen(` ${updated} `)}]. Header: ${chalk.whiteBright.bgBlue(
      ` ${header} `
    )}
    `
  );
  getCsvDiff(orig, updated, header)
    .then((res) => {
      console.log(chalk.rgb(22, 22, 22).bold.bgGreen(`getCsvDiff success. exiting.`));
      // console.log(res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('getCsvDiff error: ', err);
      process.exit(1);
    });
} else {
  console.log(
    chalk.keyword(`orange`)(
      `ERROR: invalid arguments provided, got: ${JSON.stringify(
        rawOpts,
        null,
        2
      ).reset()}. Exiting.`
    )
  );
  // chalk.reset();
  process.exit(1);
}
