import {DB} from './db.js';
import {ErrorHandler} from './error.js';

async function initializeDatabase(app) {
    try {
        await DB.the();
        app.errorHandler = new ErrorHandler(app);
        app.db = new DB(app, app.errorHandler);
        await app.db.initializeKeys();
        return app.db;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

export {initializeDatabase};