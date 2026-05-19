import { invoke, type InvokeArgs } from "@tauri-apps/api/core";

interface SerializedAppError {
    type: string;
    message: string;
}

function isSerializedAppError(error: unknown): error is SerializedAppError {
    return (
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        typeof error.type === "string" &&
        "message" in error &&
        typeof error.message === "string"
    );
}

export function toInvokeError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }

    if (isSerializedAppError(error)) {
        const normalizedError = new Error(error.message);
        normalizedError.name = error.type;
        return normalizedError;
    }

    if (typeof error === "object" && error !== null && "message" in error) {
        const normalizedError = new Error(String(error.message));

        if ("type" in error && typeof error.type === "string") {
            normalizedError.name = error.type;
        }

        return normalizedError;
    }

    return new Error(String(error));
}

export async function invokeBridge<T>(command: string, args?: InvokeArgs): Promise<T> {
    try {
        return await invoke<T>(command, args);
    } catch (error) {
        throw toInvokeError(error);
    }
}
