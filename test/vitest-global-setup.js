import fakeIndexedDB from 'fake-indexeddb';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

global.indexedDB = fakeIndexedDB
global.IDBKeyRange = FDBKeyRange
