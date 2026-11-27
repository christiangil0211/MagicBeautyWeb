namespace MagicBeauty.Store.Application.Common.Interfaces;

public enum FileStorageDestination { Products, Categories, Catalogs, Brands, Banners }
public interface IFileStorageFactory { IFileStorage Get(FileStorageDestination destination); }
