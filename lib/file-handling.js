const chalk = require('chalk');
const { Table } = require('console-table-printer');
const { promisify } = require('util');
const { normalize, basename } = require('path');
const { readFile, existsSync } = require('fs');
const neatCsv = require('neat-csv');

const pReadFile = promisify(readFile);

// colors for summary text to print to console
const dropColor = chalk.bold.red;
const addColor = chalk.green;
const origFileColor = chalk.rgb(255, 0, 0).bold.bgYellow;
const updatedFileColor = chalk.rgb(22, 22, 22).bold.bgGreen;

/**
 * Attempt to normalize a raw (absolute or relative) path, and extract the file name + extension only
 *
 * @param {String} rawPath
 * @returns {String} returns something like "stuff.csv", or 'INVALID' if failed
 */
const humanizeFileName = (rawPath) => {
  const FALLBACK = 'INVALID';
  if (rawPath && typeof rawPath == 'string' && rawPath.length) {
    const normed = normalize(rawPath) || '';
    return `${basename(normed) || ''}`;
  } else {
    console.error('Invalid file name provided: could not format');
    return FALLBACK;
  }
};

/**
 * Once CSV data has been read into a string, attempt to parse it
 *
 * @param {String} data parsed string
 * @param {String} filename name of target file (with extension- not path, just file name + extension)
 * @param {String} targetHeader name of target header field
 */
const parseCsv = async (data, filename, targetHeader) => {
  if (data && filename && targetHeader) {
    try {
      let results = new Set();
      const parsed = await neatCsv(data, {
        // mapValues: ({ value }) => (isNaN(value) ? value : Number(value))
        headers: [targetHeader],
        // mapValues: ({ header, index, value }) => {
        //   return value;
        // }
        mapValues: ({ header, index, value }) => {
          if (header == targetHeader) {
            // console.log(` -- [${index}] header: ${header}::${value}`);
            results.add(value);
            return value;
          } else {
            return;
          }
        }
      });

      //console.log(parsed);

      if (!results || !results.size) {
        throw new Error('Fail to parse CSV ');
      }
      // console.log(`-- ${filename} parse result: output set: ${results.size}`);
      return results;
    } catch (e) {
      console.error(e);
      throw new Error('Failed to parse ');
    }
  } else {
    const dataValidate =
      data && typeof data == 'string' && data.length
        ? ''
        : 'Invalid or empty data read from file';
    const filenameValidate =
      filename && typeof filename == 'string' && filename.length
        ? ''
        : 'Invalid filename provided';
    const headerValidate =
      targetHeader && typeof targetHeader == 'string' && targetHeader.length
        ? ''
        : 'Invalid header provided';
    const cleanErrors = [dataValidate, filenameValidate, headerValidate]
      .filter((x) => {
        return x && x.length;
      })
      .join(', ');
    const displayError = cleanErrors || 'An unknown error has occurred';
    console.error(`Unable to parse! Message: ${displayError}`);
    throw new Error(`Unable to parse! Message: ${displayError}`);
  }
};

/**
 * Attempt to locate the target file on disk and read it into a string
 *
 * @param {String} filePath relative or absolute path to selected file
 * @returns
 */
const readCsv = async (filePath) => {
  if (filePath && typeof filePath == 'string' && filePath.length) {
    const normalizedPath = normalize(filePath);
    const norm = humanizeFileName(filePath);
    console.log(` - Attempting to read ${normalizedPath}`);
    if (existsSync(normalizedPath)) {
      try {
        const data = await pReadFile(normalizedPath);
        if (data && data.length) {
          console.info(` - Read ${norm}`);
          return data.toString();
        } else {
          console.error(` - ReadCSV failed for ${norm}`, err);
          throw new Error(`Could not read any valid data from ${norm}`);
        }
      } catch (err) {
        console.error(` - ReadCSV failed for ${norm}`, err);
        if (err.code === 'ENOENT')
          throw new Error('Cannot find the specified CSV file.');
        throw err;
      }
    } else {
      const errMsg = ` - The file at path ${norm} does not exist or cannot be found.`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
  } else {
    const fail = ' - Could not read CSV: an invalid file path was provided';
    console.error(fail);
    throw new Error(fail);
  }
};

/**
 * Get a new Set of objects that are in Set A but not Set B
 *
 * @param setA base (original) set
 * @param setB updated set
 * @returns a new set of objects
 */
const diffSet = (setA, setB) => {
  let _difference = new Set(setA);
  for (let elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
};

/**
 * Get a new Set of objects that are in both Set A and Set B
 *
 * @param setA base (original) set
 * @param setB updated set
 * @returns a new set of objects
 */
const unionSet = (setA, setB) => {
  let _union = new Set(setA);
  for (let elem of setB) {
    _union.add(elem);
  }
  return _union;
};

/**
 * Return an object with a diff showing the row count in each input, as well as the added/dropped items
 *
 * @param {String} orig path to original file
 * @param {String} updated path to updated file
 * @param {String} header case-sensitive target header string in both files
 */
const getCsvDiff = async (orig, updated, header) => {
  return new Promise(async (resolve, reject) => {
    try {
      const origData = await readCsv(orig);
      const updatedData = await readCsv(updated);
      if (origData && updatedData) {
        const origDataRecords = await parseCsv(origData, orig, header);
        const updatedDataRecords = await parseCsv(updatedData, updated, header);
        const dropSet = diffSet(origDataRecords, updatedDataRecords);
        const addSet = diffSet(updatedDataRecords, origDataRecords);

        // union the data to generate rows
        const unionedRows = Array.from(unionSet(dropSet, addSet)).map((x) => {
          const isDrop = dropSet.has(x);
          return {
            drop: isDrop ? x : undefined,
            add: !isDrop ? x : undefined
          };
        });

        const p = new Table({
          title: `
          ${chalk.bgBlueBright.whiteBright.bold(
            ` -- Diff Summary on Header Column ${header} --`
          )}
          ${origFileColor(
            `  Original file  ${humanizeFileName(orig)} has ${
              origDataRecords.size
            } records`
          )}
          ${updatedFileColor(
            `  Updated file  ${humanizeFileName(updated)} has ${
              updatedDataRecords.size
            } records`
          )}
          ${addColor(`Added ${addSet.size} Records`)} // ${dropColor(
            `Dropped ${dropSet.size} Records`
          )}
          
          `,
          columns: [
            {
              name: 'add',
              title: `Added ${addSet.size}`,
              alignment: 'left',
              color: 'green'
            },
            {
              name: 'drop',
              title: `Dropped ${dropSet.size}`,
              alignment: 'right',
              color: 'red'
            }
          ],
          sort: (row1, row2) => {
            const r2Added = row2 && row2.add ? 1 : 0;
            const r1Added = row1 && row1.add ? 1 : 0;
            return r2Added - r1Added;
          }
        });
        p.addRows(unionedRows);

        p.printTable();
        resolve(unionedRows);
      } else {
        console.log('fail!');
        reject('fail');
      }
    } catch (e) {
      console.error('getCsvDiff failed: ', e);
      reject(e);
    }
  });
};

module.exports = {
  getCsvDiff
};
