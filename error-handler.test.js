import {ErrorHandler} from './error-handler.js';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('ErrorHandler', () => {
    let app;
    let errorHandler;
    let consoleErrorSpy;

    beforeEach(() => {
        app = {
            notificationManager: {
                showNotification: vi.fn(),
            },
        };
        errorHandler = new ErrorHandler(app);
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should log the error and show a notification', () => {
        const error = new Error('Test error');
        const message = 'Test message';
        errorHandler.handleError(error, message);
        expect(app.notificationManager.showNotification).toHaveBeenCalledWith(`${message}: ${error.message}`, 'error');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(message), error);
    });

    it('should log a default message if no message is provided', () => {
        const error = new Error('Test error');
        errorHandler.handleError(error);
        expect(app.notificationManager.showNotification).toHaveBeenCalledWith(`An unexpected error occurred.: ${error.message}`, 'error');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('An unexpected error occurred.'), error);
    });

    it('should log the error with timestamp and error name', () => {
        const error = new Error('Test error');
        error.name = 'TestError';
        const message = 'Test message';
        errorHandler.handleError(error, message);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[')
            , error);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Test message: TestError - Test error')
            , error);
    });
});