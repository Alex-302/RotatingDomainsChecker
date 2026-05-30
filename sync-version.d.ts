export function extractVersionFromFile(filePath: string): string | null;

export function validateVersion(version: string): void;

export function updateSourceVersion(filePath: string, newVersion: string): boolean;

export function updateJsonFile(filePath: string, newVersion: string, versionKey?: string): boolean;

export function updatePackageLockVersion(filePath: string, newVersion: string): boolean;