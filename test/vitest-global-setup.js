import { FakeIndexedDB } from 'fake-indexeddb';
global.indexedDB = new FakeIndexedDB();
