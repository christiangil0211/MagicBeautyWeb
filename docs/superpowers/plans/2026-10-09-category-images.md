# Category images implementation

Approved scope: no schema/Azure/git publication changes; preserve existing frontend work.

1. Add backend tests for JSON ownership, container selection and image lifecycle. Run failing tests.
2. Keep Products IFileStorage registration; add destination factory backed by the same storage implementations. Add CategoryContainerName and preserve local /media. Move image rules to Common.
3. Add category multipart PUT/DELETE (image/home/icon), compensation and owned URL cleanup. Remove URL fields from JSON write contracts; retain entity/read DTOs.
4. Replace text fields with file selection, previews and removal. Save category before uploads; retain successful uploads on partial failures.
5. Run backend build/test, full frontend tests and Production build; inspect diff and list changed files.

Review focus: stale JSON, failed persistence, external URLs, container isolation, partial upload retries.
