import { homedir } from 'os';
import { MarkdownString, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { Post } from '../models/post';
import { globalState } from '../services/global-state';
import { PostFileMapManager } from '../services/post-file-map';
import { Settings } from '../services/settings.service';
import { BaseTreeItemSource } from './models/base-tree-item-source';

const contextValues = {
    post({ id }: Post) {
        return PostFileMapManager.getFilePath(id) !== undefined ? 'cnb-post-cached' : 'cnb-post';
    },
};

export type TreeItemSource = Post | TreeItem | BaseTreeItemSource;

interface Converter<T> {
    (s: T): TreeItem | Promise<TreeItem>;
}

const postConverter: Converter<Post> = obj => {
    const descDatePublished = obj.datePublished ? `  \n发布于: ${obj.datePublished}` : '';
    const localPath = PostFileMapManager.getFilePath(obj.id);
    const localPathForDesc = localPath?.replace(homedir(), '~') || '未关联本地文件';
    const descLocalPath = localPath ? `  \n本地路径: ${localPathForDesc}` : '';
    let url = obj.url;
    url = url.startsWith('//') ? `https:${url}` : url;
    return Object.assign<TreeItem, TreeItem>(new TreeItem(`${obj.title}`, TreeItemCollapsibleState.Collapsed), {
        tooltip: new MarkdownString(`[${url}](${url})` + descDatePublished + descLocalPath),
        command: {
            command: `${globalState.extensionName}.edit-post`,
            arguments: [obj.id],
            title: '编辑博文',
        },
        contextValue: contextValues.post(obj),
        iconPath: new ThemeIcon(obj.isMarkdown ? 'markdown' : 'file-code'),
        description: localPath ? localPathForDesc : '',
        resourceUri: Uri.joinPath(Settings.workspaceUri, obj.title + (obj.isMarkdown ? '.md' : '.html')),
    });
};

const baseTreeItemSourceConverter: Converter<BaseTreeItemSource> = obj => obj.toTreeItem();
const converter: Converter<TreeItemSource> = obj => {
    if (obj instanceof TreeItem) {
        return obj;
    } else if (obj instanceof BaseTreeItemSource) {
        return baseTreeItemSourceConverter(obj);
    } else {
        return postConverter(obj);
    }
};

export const toTreeItem = <T extends TreeItemSource>(obj: T) => converter(obj);