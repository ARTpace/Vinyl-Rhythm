export declare const saveLibraryHandle: (handle: FileSystemDirectoryHandle) => Promise<void>;
export declare const getLibraryHandle: () => Promise<FileSystemDirectoryHandle | null>;
export declare const loadTracksMetadata: () => any[];
export declare const saveTracksMetadata: (tracks: any[]) => void;
