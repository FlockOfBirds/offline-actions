// tslint:disable no-console no-eval TODO: Remove this line pre-release
export interface Action {
    actionType: ActionType;
    precondition: string;
    errorMessage: string;
    syncOnSavePage: boolean;
    syncOnCommitObject: boolean;
    newObjectEntity: string;
    getOrCreateObjectEntity: string;
    newAttribute: string;
    newAttributeValue: string;
    syncDataOnly: boolean;
    openPage: string;
    openPageLocation: "content" | "popup" | "modal";
    customAction: string;
}

export type ActionType = "savePage" | "openPage" | "closePage" | "closePopup" | "commitObject" | "createObject"
    | "getOrCreateObject" | "changeObject" | "sync" | "showProgress" | "hideProgress" | "custom";

export class Actions {
    private contextObject?: mendix.lib.MxObject;
    private actionObject?: mendix.lib.MxObject;
    private mxForm: mxui.lib.form._FormBase;
    private currentAction: ActionType;
    private successCallback: () => void;
    private errorCallback: (error: Error) => void;
    private processId: number;

    constructor(contextObject?: mendix.lib.MxObject) {
        this.contextObject = contextObject;
    }

    setContextObject(contextObject?: mendix.lib.MxObject): Actions {
        this.contextObject = contextObject;

        return this;
    }

    setActionObject(mxObject: mendix.lib.MxObject) {
        this.actionObject = mxObject;
    }

    setMxForm(mxForm: mxui.lib.form._FormBase): Actions {
        this.mxForm = mxForm;

        return this;
    }

    setSuccessCallback(callback: () => void): Actions {
        this.successCallback = callback;

        return this;
    }

    setErrorCallback(callback: (error: Error) => void): Actions {
        this.errorCallback = callback;

        return this;
    }

    savePage(syncOnSave: boolean) {
        this.currentAction = "savePage";
        this.mxForm.commit(() => {
            if (syncOnSave) {
                mx.data.synchronizeOffline({ fast: true }, this.successCallback, this.errorCallback);
            } else {
                this.successCallback();
            }
        }, this.errorCallback);
    }

    openPage(action: Action) {
        if (this.actionObject) {
            const context = new mendix.lib.MxContext();
            context.setContext(this.actionObject.getEntity(), this.actionObject.getGuid());
            mx.ui.openForm(action.openPage, {
                location: action.openPageLocation,
                context,
                callback: this.successCallback
            }, this);
        } else {
            mx.ui.openForm(action.openPage, {
                location: "content",
                callback: this.successCallback
            }, this);
        }
    }

    commitObject(action: Action) {
        if (this.contextObject) {
            mx.data.commit({
                mxobj: this.contextObject,
                callback: () => {
                    if (action.syncOnCommitObject) {
                        mx.data.synchronizeOffline({ fast: true }, this.successCallback, this.errorCallback);
                    } else {
                        this.successCallback();
                    }
                },
                error: this.errorCallback
            }, this);
        }
    }

    createObject(entity: string) {
        mx.data.create({
            entity,
            callback: object => {
                this.actionObject = object;
                this.successCallback();
            },
            error: this.errorCallback
        }, this);
    }

    getOrCreateObject(action: Action) {
        this.getEntity(action.getOrCreateObjectEntity, mxObject => {
            if (mxObject) {
                this.setActionObject(mxObject);
                this.successCallback();
            } else {
                this.createObject(action.getOrCreateObjectEntity);
            }
        });
    }

    changeObject(newAttribute: string, value: string) {
        if (this.contextObject && this.actionObject) {
            this.actionObject.set(newAttribute, value);
            this.successCallback();
        }
    }

    closePage() {
        mx.ui.back();
        this.successCallback();
    }

    closePopup() {
        (this.mxForm as any).close(); // TODO: Add close to mendix-client typings
        this.successCallback();
    }

    sync(syncDataOnly: boolean) {
        mx.data.synchronizeOffline({ fast: syncDataOnly }, this.successCallback, this.errorCallback);
    }

    showProgress() {
        this.processId = mx.ui.showProgress();
        this.successCallback();
    }

    hideProgress() {
        if (this.processId) {
            mx.ui.hideProgress(this.processId);
        }
        this.successCallback();
    }

    custom(action: string) {
        try {
            eval(action);
            this.successCallback();
        } catch (error) {
            this.errorCallback(error);
        }
    }

    private getEntity(entity: string, onSuccess: (obj?: mendix.lib.MxObject) => void) {
        if ((mx as any).isOffline()) { // TODO: Add isOffline & getSlice to mendix-client typings
            (mx.data as any).getSlice(entity, [], {}, false, (mxObjects: mendix.lib.MxObject[], count: number) => {
                if (count > 0) {
                    onSuccess(mxObjects[0]);
                } else {
                    onSuccess();
                }
            }, this.errorCallback);
        } else {
            try {
                mx.data.get({
                    xpath: "//" + entity,
                    callback: objs => {
                        if (objs.length > 0) {
                            onSuccess(objs[0]);
                        } else {
                            onSuccess();
                        }
                    }
                }, this);
            } catch (error) {
                this.errorCallback(error);
            }
        }
    }
}
