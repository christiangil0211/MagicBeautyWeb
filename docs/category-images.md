# Category images

Categories uses the existing AzureBlobFileStorage via IFileStorageFactory. Products retains its original IFileStorage singleton and behavior.

Production configuration (Managed Identity, no new credentials):

- Storage__AzureBlob__ServiceUri=https://stmagicbeautydev.blob.core.windows.net
- Storage__AzureBlob__ContainerName=product-images
- Storage__AzureBlob__CategoryContainerName=category-images
- Optional Storage__AzureBlob__CategoryPublicBaseUrl for a category-specific CDN base.

Containers must already exist when using Managed Identity. No container access changes are made. Azure RBAC and public access have not been inspected or modified. Development without Azure configuration continues serving local files from /media.

PUT /api/categories/{id}/images/{kind} accepts multipart file; DELETE clears the selected image. Both inherit StoreAdmin. kind is image/home/icon. JPG/PNG/WEBP/GIF signatures are accepted, at most 8 MB (HTTP multipart limit 9 MB). Paths are categories/{id}/{kind}/{guid}.{ext}.

ImageUrl/HomeImageUrl/IconUrl remain on entity and read DTO; JSON create/update contracts no longer write these fields. Old JSON properties are ignored by normal deserialization. Frontend retains URL controls internally only for persisted previews; excludes them from JSON. New categories are saved before sequential uploads. Successful uploads are retained on partial failure; retries reuse the ID and remaining files. Remove is applied on Save.

Replacement saves a unique new blob, commits its URL, then removes the old owned URL if not shared. Failed persistence restores the previous tracked URL and attempts to remove the new blob. Deletion commits null before removal. Category deletion cleans its owned images after commit. External URLs are ignored by the storage implementation. Shared category URLs are retained.

Cleanup failures are logged with URL and do not turn a committed operation into a failed upload. No durable cleanup queue was added; a process crash or persistent storage failure can still leave orphan files requiring reconciliation. No schema change or migration.

Verification commands:

- dotnet build backend/MagicBeauty.Store.slnx
- dotnet test backend/MagicBeauty.Store.slnx
- npm --prefix frontend/magicbeauty-store-app test -- --watch=false
- npm --prefix frontend/magicbeauty-store-app run build -- --configuration production

## Exact files for this implementation

Previous 14 modified files and 3 added tests were preserved and are excluded below.

Modified or removed (ImageUploadRules moved to Common):

- `backend/MagicBeauty.Store.slnx`
- `backend/src/MagicBeauty.Store.Api/Controllers/CategoriesController.cs`
- `backend/src/MagicBeauty.Store.Api/appsettings.Development.example.json`
- `backend/src/MagicBeauty.Store.Api/appsettings.Production.example.json`
- `backend/src/MagicBeauty.Store.Application/Features/Categories/CategoryService.cs`
- `backend/src/MagicBeauty.Store.Application/Features/Categories/ICategoryService.cs`
- `backend/src/MagicBeauty.Store.Application/Features/Products/ImageUploadRules.cs`
- `backend/src/MagicBeauty.Store.Application/Features/Products/ProductService.cs`
- `backend/src/MagicBeauty.Store.Application/MagicBeauty.Store.Application.csproj`
- `backend/src/MagicBeauty.Store.Contracts/Categories/Requests/CreateCategoryRequest.cs`
- `backend/src/MagicBeauty.Store.Contracts/Categories/Requests/UpdateCategoryRequest.cs`
- `backend/src/MagicBeauty.Store.Infrastructure/DependencyInjection.cs`
- `backend/src/MagicBeauty.Store.Infrastructure/Storage/FileStorages.cs`
- `frontend/magicbeauty-store-app/src/app/core/services/category.service.ts`
- `frontend/magicbeauty-store-app/src/app/features/admin/categories/admin-categories.component.html`
- `frontend/magicbeauty-store-app/src/app/features/admin/categories/admin-categories.component.scss`
- `frontend/magicbeauty-store-app/src/app/features/admin/categories/admin-categories.component.ts`
- `frontend/magicbeauty-store-app/src/app/shared/models/category.model.ts`

Added:

- `backend/src/MagicBeauty.Store.Application/Common/ImageUploadRules.cs`
- `backend/src/MagicBeauty.Store.Application/Common/Interfaces/IFileStorageFactory.cs`
- `backend/src/MagicBeauty.Store.Infrastructure/Storage/FileStorageFactory.cs`
- `backend/tests/MagicBeauty.Store.Tests/CategoryImagesTests.cs`
- `backend/tests/MagicBeauty.Store.Tests/MagicBeauty.Store.Tests.csproj`
- `docs/category-images.md`
- `docs/superpowers/plans/2026-10-09-category-images.md`
- `frontend/magicbeauty-store-app/src/app/features/admin/categories/admin-categories.component.spec.ts`

Final verification: backend build 0 warnings/errors; backend 15 tests passed; frontend Production build passed; frontend 8 tests passed in 5 files; git diff --check passed (only Windows line-ending notices). Azure was not accessed for runtime upload testing.
