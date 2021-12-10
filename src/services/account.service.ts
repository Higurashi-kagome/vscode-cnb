import { convertObjectKeysToCamelCase } from './fetch-json-response-to-camel-case';
import { UserAuthorizationInfo, UserInfo } from './../models/user-settings';
import { globalManager } from '../models/global-manager';
import { CnblogsOAuthService } from './cnblogs-oauth.service';
import * as vscode from 'vscode';
import { URLSearchParams } from 'url';
import { generateCodeChallenge } from './code-challenge.service';
import * as RandomString from 'randomstring';
import fetch from 'node-fetch';

const isAuthorizedStorageKey = 'isAuthorized';

export class AccountService extends vscode.Disposable {
    private static _instance: AccountService = new AccountService();

    static buildBearerAuthorizationHeader(accessToken: string): [string, string] {
        return ['Authorization', `Bearer ${accessToken}`];
    }

    private _curUser?: UserInfo;
    private _oauthServ = new CnblogsOAuthService();

    static get instance() {
        return this._instance;
    }

    get isAuthorized() {
        return globalManager.storage.get(isAuthorizedStorageKey);
    }

    get curUser(): UserInfo {
        return this._curUser ? this._curUser : globalManager.storage.get('user') ?? new UserInfo();
    }

    protected constructor() {
        super(() => this._oauthServ.dispose());
    }

    async login() {
        const { codeVerifier, codeChallenge } = generateCodeChallenge();
        this._oauthServ.startListenAuthorizationCodeCallback(codeVerifier, (authorizationInfo, err) => {
            if (authorizationInfo && !err) {
                this.handleAuthorized(authorizationInfo);
            }
        });
        const { clientId, responseType, scope, authorizeEndpoint, authority } = globalManager.config.oauth;
        let url = `${authority}${authorizeEndpoint}`;
        const search = new URLSearchParams([
            ['client_id', clientId],
            ['response_type', responseType],
            ['redirect_uri', this._oauthServ.listenUrl],
            ['nonce', RandomString.generate(32)],
            ['code_challenge', codeChallenge],
            ['code_challenge_method', 'S256'],
            ['scope', scope],
        ]);
        url = `${url}?${search}`;
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    async logout() {
        if (!this.isAuthorized) {
            return;
        }

        const { clientId, revocationEndpoint, authority } = globalManager.config.oauth;
        const token = this.curUser?.authorizationInfo?.accessToken;

        this.setIsAuthorized(false);
        globalManager.storage.update('user', {});

        if (token) {
            const body = new URLSearchParams([
                ['client_id', clientId],
                ['token', token],
                ['token_type_hint', 'access_token'],
            ]);
            let url = `${authority}${revocationEndpoint}`;
            const res = await fetch(url, {
                method: 'POST',
                body: body,
                headers: [
                    AccountService.buildBearerAuthorizationHeader(token),
                    ['Content-Type', 'application/x-www-form-urlencoded'],
                ],
            });
            if (!res.ok) {
                console.warn('Revocation failed', res);
            }
        }
    }

    async refreshUserInfo() {
        if (this.curUser && this.curUser.authorizationInfo) {
            await this.fetchAndStoreUserInfo(this.curUser.authorizationInfo);
        }
    }

    async setIsAuthorizedToContext() {
        await vscode.commands.executeCommand(
            'setContext',
            `${globalManager.extensionName}.${isAuthorizedStorageKey}`,
            this.isAuthorized
        );
        if (this.isAuthorized) {
            await vscode.commands.executeCommand('setContext', `${globalManager.extensionName}.user`, {
                name: this.curUser.name,
                avatar: this.curUser.avatar,
            });
        }
    }

    private async setIsAuthorized(authorized = false): Promise<void> {
        await globalManager.storage.update(isAuthorizedStorageKey, authorized);
        this.setIsAuthorizedToContext();
    }

    private async handleAuthorized(authorizationInfo: UserAuthorizationInfo) {
        await this.fetchAndStoreUserInfo(authorizationInfo);
        await this.setIsAuthorized(true);
    }

    private async fetchAndStoreUserInfo(authorizationInfo: UserAuthorizationInfo) {
        const userInfo = await this.fetchUserInfo(authorizationInfo);
        await globalManager.storage.update('user', userInfo);
        return userInfo;
    }

    private async fetchUserInfo(authorizationInfo: UserAuthorizationInfo): Promise<UserInfo> {
        const { authority, userInfoEndpoint } = globalManager.config.oauth;
        const res = await fetch(`${authority}${userInfoEndpoint}`, {
            method: 'GET',
            headers: [AccountService.buildBearerAuthorizationHeader(authorizationInfo.accessToken)],
        });
        const obj = convertObjectKeysToCamelCase((await res.json()) as any);
        obj.avatar = obj.picture;
        delete obj.picture;
        return Object.assign(new UserInfo(authorizationInfo), obj, { avatar: obj.picture });
    }
}

export const accountService = AccountService.instance;
