-- Restrict server media uploads to 50 MiB and supported image/video types.
update storage.buckets
set file_size_limit=52428800,
    allowed_mime_types=ARRAY[
      'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif',
      'video/mp4','video/quicktime','video/x-m4v','video/webm'
    ]::text[]
where id='task-media';
