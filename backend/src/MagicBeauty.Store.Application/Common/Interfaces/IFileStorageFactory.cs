namespace MagicBeauty.Store.Application.Common.Interfaces;

public enum FileStorageDestination { Products, Categories }
public interface IFileStorageFactory { IFileStorage Get(FileStorageDestination destination); }
