export interface ValueResponse<T> {
    error?: Error;
    value: T;
}