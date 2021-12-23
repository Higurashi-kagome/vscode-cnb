import { QuickPickItem, window } from 'vscode';
import { BlogPost } from '../models/blog-post';
import { blogPostService } from './blog-post.service';

class PostPickItem implements QuickPickItem {
    constructor(public post: BlogPost) {
        this.label = post.title;
        this.description = post.description;
    }

    label: string;
    description?: string | undefined;
    detail?: string | undefined;
    picked?: boolean | undefined;
    alwaysShow?: boolean | undefined;
}

export const searchPostsByTitle = async ({
    postTitle = '',
    quickPickTitle = '按标题搜索博文',
}): Promise<BlogPost | undefined> => {
    return await new Promise<BlogPost | undefined>(resolve => {
        const quickPick = window.createQuickPick<PostPickItem>();
        quickPick.title = quickPickTitle;
        quickPick.value = postTitle ?? '';
        quickPick.placeholder = '输入标题以搜索博文';
        const handleValueChange = async () => {
            if (!quickPick.value) {
                return;
            }
            const value = quickPick.value;
            try {
                quickPick.busy = true;
                const paged = await blogPostService.fetchPostsList({ search: value });
                const posts = paged.items;
                const pickItems = posts.map(p => new PostPickItem(p));
                if (value === quickPick.value) {
                    quickPick.items = pickItems;
                }
            } finally {
                quickPick.busy = false;
            }
        };
        quickPick.onDidChangeValue(async () => {
            await handleValueChange();
        });
        let selected: PostPickItem | undefined = undefined;
        quickPick.onDidChangeSelection(() => {
            selected = quickPick.selectedItems[0];
            if (selected) {
                quickPick.hide();
            }
        });
        quickPick.onDidHide(() => {
            resolve(selected?.post);
            quickPick.dispose();
        });
        quickPick.show();
        handleValueChange();
    });
};