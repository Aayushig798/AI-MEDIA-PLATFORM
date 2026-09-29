/**
 * Configuration and Tuning Thresholds for Before/After Evidence Comparison
 */

export const COMPARISON_CONFIG = {
  // Hard rule minimum time difference in hours between capturedAt dates (default 4 hours allows same-day comparisons)
  MIN_GAP_HOURS: 4,

  // Backward compatibility alias for days (4 hours = 0.1667 days)
  MIN_GAP_DAYS: 4 / 24,

  // Threshold for cleaning up unverified comparisons
  CLEANUP_CONFIDENCE_THRESHOLD: 0.3,

  // Maximum GPS distance in meters between two photos if both have EXIF GPS
  MAX_GPS_DISTANCE_METERS: 200,

  // Minimum weighted AI tag overlap score between candidate pairs:
  // sum(min(confA, confB)) / sum(max(confA, confB)) over union of labels
  MIN_TAG_OVERLAP: 0.25,

  // Minimum cosine similarity between MediaEmbedding vectors when both exist
  MIN_EMBED_SIM: 0.6,

  // Maximum number of top candidates from gate 1 & 2 sent to OpenAI Vision verification
  VISION_VERIFY_TOP_K: 5,

  // Minimum confidence required from OpenAI GPT-4o-mini vision verification
  MIN_VISION_CONFIDENCE: 0.7,

  // Downscaled image width for OpenAI vision payload (w_512 keeps latency and cost minimal)
  VISION_IMAGE_WIDTH: 512,
} as const;
