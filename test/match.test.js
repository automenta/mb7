import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Matcher} from '../core/match.js';
import {createAppMock} from './test-utils.js';
import {getTagDefinition} from '../core/ontology.js';

vi.mock('../core/ontology.js', () => {
    return {
        getTagDefinition: vi.fn().mockReturnValue({
            validate: vi.fn().mockReturnValue(true),
        }),
    };
});

describe('Matcher', () => {
    let matcher;
    let app;

    beforeEach(() => {
        app = createAppMock();
        matcher = new Matcher(app);
    });

    describe('matchTagData', () => {
        it('should return false if tagDef.validate returns false', async () => {
            getTagDefinition.mockReturnValue({validate: vi.fn().mockReturnValue(false)});
            const tagData = {name: 'test', condition: 'is', value: 'value'};
            const text = 'text';
            const event = {};
            const result = await matcher.matchTagData(tagData, text, event);
            console.log('Result type:', typeof result);
            expect(result).toBe(false);
        });
        it('should return true if condition is "is" and text includes value', async () => {
            getTagDefinition.mockReturnValue({validate: vi.fn().mockReturnValue(true)});
            const tagData = {name: 'test', condition: 'is', value: 'value'.toLowerCase()};
            const text = 'text with value'.toLowerCase();
            const event = {};
            const result = await matcher.matchTagData(tagData, text, event);
            console.log('Result type:', typeof result);
            expect(result).toBe(true);
        });
        it('should return false if condition is "is" and text does not include value', async () => {
            getTagDefinition.mockReturnValue({validate: vi.fn().mockReturnValue(true)});
            const tagData = {name: 'test', condition: 'is', value: 'value'.toLowerCase()};
            const text = 'text without value'.toLowerCase();
            const event = {};
            const result = await matcher.matchTagData(tagData, text, event);
            console.log('Result type:', typeof result);
            expect(result).toBe(false);
        });
    });

    describe('matchEvent', () => {
        it('should call showNotification if matches are found', async () => {
            app.db.getAll.mockResolvedValue([{
                id: '1',
                name: 'Test Object',
                content: 'Test Content',
                updatedAt: Date.now()
            }]);
            matcher.matchTagData = vi.fn().mockReturnValue(true);
            app.showNotification = vi.fn();
            const event = {content: 'test', pubkey: 'a'.repeat(64), tags: []};
            await matcher.matchEvent(event);
            expect(app.showNotification).toHaveBeenCalled();
        });

        it('should not call showNotification if no matches are found', async () => {
            app.db.getAll.mockResolvedValue([]);
            matcher.fuse.search = vi.fn().mockReturnValue([]);
            app.showNotification = vi.fn();
            const event = {content: 'test', pubkey: 'testpubkey', tags: []};
            await matcher.matchEvent(event);
            expect(app.showNotification).not.toHaveBeenCalled();
        });
    });
});
