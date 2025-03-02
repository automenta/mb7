const fakeIndexedDB = require('fake-indexeddb');
global.indexedDB = new fakeIndexedDB.FakeIndexedDB();