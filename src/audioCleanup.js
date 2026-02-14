const fs = require('fs');
const path = require('path');

/** Default max age in hours (0 = disabled) */
const DEFAULT_MAX_AGE_HOURS = 24;

/** Minimum age in minutes before a file can be deleted (grace period for playback) */
const DEFAULT_MIN_AGE_MINUTES = 15;

/**
 * Cleans audio directory: removes merged MP3 files older than maxAgeMs
 * and at least minAgeMs old (grace period so we never delete a file being played).
 * Only touches files matching merged_*.mp3; ignores chunks and .gitkeep.
 *
 * @param {string} audioDir - Absolute path to the audio directory
 * @param {number} maxAgeMs - Max age in milliseconds (files older are candidates)
 * @param {number} minAgeMs - Min age in milliseconds (files newer are never deleted)
 * @returns {{ deleted: number, errors: number }}
 */
function cleanOldAudioFiles(audioDir, maxAgeMs, minAgeMs = 0) {
  if (!fs.existsSync(audioDir)) return { deleted: 0, errors: 0 };

  const now = Date.now();
  let deleted = 0;
  let errors = 0;

  const files = fs.readdirSync(audioDir);

  for (const file of files) {
    // Only remove final merged files, not chunk_* or concat_* (chunks are removed right after merge)
    if (!file.match(/^merged_.*\.mp3$/)) continue;

    const filePath = path.join(audioDir, file);
    try {
      const stats = fs.statSync(filePath);
      const ageMs = now - stats.mtimeMs;
      // Never delete if too recent (user may be listening); only delete if past both thresholds
      if (ageMs > minAgeMs && ageMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch (err) {
      console.error('Error during audio cleanup:', file, err.message);
      errors++;
    }
  }

  return { deleted, errors };
}

/**
 * Runs cleanup once using AUDIO_MAX_AGE_HOURS (0 = disabled).
 * Files newer than AUDIO_MIN_AGE_MINUTES are never deleted (grace period for playback).
 * @param {string} [audioDir] - Optional; defaults to project audio/
 * @returns {{ deleted: number, errors: number } | null} - null if cleanup disabled
 */
function runCleanup(audioDir) {
  const dir = audioDir || path.join(__dirname, '..', 'audio');
  const hours = parseInt(process.env.AUDIO_MAX_AGE_HOURS, 10);

  if (Number.isNaN(hours) || hours <= 0) {
    return null;
  }

  const maxAgeMs = hours * 60 * 60 * 1000;
  const minMinutes = parseInt(process.env.AUDIO_MIN_AGE_MINUTES, 10);
  const minAgeMs = Number.isNaN(minMinutes) || minMinutes < 0
    ? DEFAULT_MIN_AGE_MINUTES * 60 * 1000
    : minMinutes * 60 * 1000;

  const result = cleanOldAudioFiles(dir, maxAgeMs, minAgeMs);

  if (result.deleted > 0 || result.errors > 0) {
    console.log(`Audio cleanup: removed ${result.deleted} old file(s), ${result.errors} error(s)`);
  }

  return result;
}

/**
 * Schedules periodic cleanup every intervalMs.
 * @param {number} intervalMs - Interval in milliseconds (e.g. 3600000 = 1 hour)
 * @param {string} [audioDir] - Optional audio directory
 * @returns {NodeJS.Timeout | null} - Timer handle, or null if cleanup disabled
 */
function scheduleCleanup(intervalMs, audioDir) {
  const hours = parseInt(process.env.AUDIO_MAX_AGE_HOURS, 10);
  if (Number.isNaN(hours) || hours <= 0) return null;

  runCleanup(audioDir);

  return setInterval(() => {
    runCleanup(audioDir);
  }, intervalMs);
}

module.exports = {
  cleanOldAudioFiles,
  runCleanup,
  scheduleCleanup,
  DEFAULT_MAX_AGE_HOURS,
  DEFAULT_MIN_AGE_MINUTES
};
