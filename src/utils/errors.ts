export class GitBunError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GitBunError";
    }
}

export class ValidationError extends GitBunError {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

export class CancellationError extends GitBunError {
    constructor(message: string = "Commit cancelled.") {
        super(message);
        this.name = "CancellationError";
    }
}
