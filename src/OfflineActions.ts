// tslint:disable no-console no-eval TODO: Remove this line pre-release
import * as dojoDeclare from "dojo/_base/declare";
import * as WidgetBase from "mxui/widget/_WidgetBase";

interface Action {
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

type ActionType = "savePage" | "openPage" | "closePage" | "closePopup" | "commitObject" | "createObject"
    | "getOrCreateObject" | "changeObject" | "sync" | "showProgress" | "hideProgress" | "custom";

class OfflineActions extends WidgetBase {
    // Properties from the Mendix modeler
    trigger: "onclick" | "onload" | "onchange";
    elementName: string;
    onChangeAttribute: string;
    actions: Action[];

    private contextObject: mendix.lib.MxObject;
    private onChangeSubscription: number;
    private currentValue: string | number | boolean;
    private currentActionIndex: number;
    private pid: number;
    private actionContextObject: mendix.lib.MxObject;

    postCreate() {
        this.currentActionIndex = -1;
        this.setupTrigger();
    }

    update(contextObject: mendix.lib.MxObject, callback?: () => void) {
        this.contextObject = contextObject;
        this.updateActionContext(contextObject);

        if (callback) {
            callback();
        }
        if (this.trigger === "onchange") {
            this.attachOnChange();
        }
    }

    private setupTrigger() {
        if (this.trigger === "onclick") {
            window.setTimeout(this.setElementEventHandler.bind(this), 50);
        } else if (this.trigger === "onload") {
            // TODO: could also be in update but only if there is a context. introduce option or two widgets
            window.setTimeout(this.run.bind(this), 0);
        }
    }

    private onclickAction() {
        this.run();
    }

    private setElementEventHandler() {
        const elements = document.getElementsByClassName("mx-name-" + this.elementName.trim());
        if (elements.length === 0) {
            // TODO: sometimes happens after a close.
            console.log("Found " + elements.length + " elements instead of 1");
            return;
        }
        elements[0].addEventListener("click", this.onclickAction.bind(this));
    }

    private attachOnChange() {
        if (this.onChangeSubscription) {
            this.unsubscribe(this.onChangeSubscription);
        }
        this.onChangeSubscription = this.subscribe({
            guid: this.contextObject.getGuid(),
            attr: this.onChangeAttribute,
            callback: guid => {
                mx.data.get({
                    guid,
                    callback: obj => {
                        this.currentValue = obj.get(this.onChangeAttribute);
                        this.run();
                    }
                }, this);
            }
        });
    }

    private run(callback?: () => void) {
        if (callback) {
            callback();
        }
        this.reset();
        this.performNextAction();
    }

    private reset() {
        this.currentActionIndex = -1;
    }

    private performNextAction() {
        this.currentActionIndex++;
        if (this.currentActionIndex === this.actions.length) {
            console.log("Done with all actions");
            return;
        }
        const action = this.actions[this.currentActionIndex];
        if (action.precondition.trim()) {
            try {
                // TODO: find alternative to eval
                const result = eval(this.replaceVariables(action.precondition));
                console.log("Result of " + action.precondition + ": " + result);
                if (result === false) {
                    console.log("skipping", action);
                    this.performNextAction();
                    return;
                }
            } catch (e) {
                console.log("error while evaluating precondition: " + action.precondition);
                this.onError(action, e);
                this.reset();
                return;
            }
        }
        console.log("performing action " + this.currentActionIndex, action, this.actionContextObject);
        if (action.actionType === "commitObject") {
            this.performCommitObject(action);
        } else if (action.actionType === "savePage") {
            this.performSavePage(action);
        } else if (action.actionType === "createObject") {
            this.performCreateObject(action);
        } else if (action.actionType === "getOrCreateObject") {
            this.performGetOrCreateObject(action);
        } else if (action.actionType === "changeObject") {
            this.performChangeObject(action);
        } else if (action.actionType === "openPage") {
            this.performOpenPage(action);
        } else if (action.actionType === "closePage") {
            this.performClosePage();
        } else if (action.actionType === "closePopup") {
            this.performClosePopup();
        } else if (action.actionType === "sync") {
            this.performSync(action);
        } else if (action.actionType === "showProgress") {
            this.performShowProgress();
        } else if (action.actionType === "hideProgress") {
            this.performHideProgress();
        } else if (action.actionType === "custom") {
            this.performCustom(action);
        } else {
            mx.ui.error("Unknown action: " + action.actionType);
        }
    }

    private replaceVariables(code: string) {
        if (this.contextObject) {
            // TODO: add metaData to mendix.lib.MxObject typings
            const attributes = (this.contextObject as any).metaData.getAttributesWithoutReferences();
            for (const i of attributes) {
                code = code.replace(new RegExp("\\$" + attributes[i], "g"), "" + this.contextObject.get(attributes[i]));
            }
        }
        if (this.currentValue) {
            code = code.replace(new RegExp("\\$value", "g"), "" + this.currentValue);
        }

        return code;
    }

    private onError(action: Action, e: Error) {
        console.log("Error while executing action: ", action);
        console.log("Error: ", e);
        if (this.pid) {
            mx.ui.hideProgress(this.pid);
        }
        const msg = action.errorMessage || "An unexpected error occured";
        mx.ui.error(msg, true);
    }

    private updateActionContext(contextObject: mendix.lib.MxObject) {
        this.actionContextObject = contextObject;
    }

    // TODO: use mx.data.getOffline
    private getEntity(entity: string, successCallback: (obj?: mendix.lib.MxObject) => void, errorCallback: (error: Error) => void) { // tslint:disable-line max-line-length
        console.log("Entity: " + entity);
        if ((mx as any).isOffline()) { // TODO: Add isOffline & getSlice to mendix-client typings
            (mx.data as any).getSlice(entity, [
                    /*{
                                            attribute: attribute,
                                            operator: "equals",
                                            value: guid
                                        }*/
                ], {}, false,
                (objs: mendix.lib.MxObject[], count: number) => {
                    if (count > 0) {
                        successCallback(objs[0]);
                    } else {
                        successCallback();
                    }
                },
                errorCallback
            );
        } else {
            try {
                mx.data.get({
                    xpath: "//" + entity /* + "[" + attribute + "=" + guid + "]"*/ ,
                    callback: objs => {
                        if (objs.length > 0) {
                            successCallback(objs[0]);
                        } else {
                            successCallback();
                        }
                    }
                }, this);
            } catch (e) {
                errorCallback(e);
            }
        }
    }

    private performCommitObject(action: Action) {
        // TODO: use entity parameter (when implemented as dropdown field) to select the entity to commit
        mx.data.commit({
            mxobj: this.contextObject,
            callback: () => {
                if (action.syncOnCommitObject) {
                    mx.data.synchronizeOffline(
                        { fast: true },
                        () => this.performNextAction(),
                        e => {
                            this.onError(action, e);
                            this.reset();
                        }
                    );
                } else {
                    this.performNextAction();
                }
            },
            error: e => {
                this.onError(action, e);
                this.reset();
            }
        }, this);
    }

    private performSavePage(action: Action) {
        this.mxform.commit(
            () => {
                if (action.syncOnSavePage) {
                    mx.data.synchronizeOffline(
                        { fast: true },
                        () => this.performNextAction(),
                        e => {
                            this.onError(action, e);
                            this.reset();
                        }
                    );
                } else {
                    this.performNextAction();
                }

            },
            e => {
                this.onError(action, e);
                this.reset();
            }
        );
    }

    private performCreateObject(action: Action) {
        mx.data.create({
            entity: action.newObjectEntity,
            callback: obj => {
                this.updateActionContext(obj);
                this.performNextAction();
            },
            error: e => {
                this.onError(action, e);
                this.reset();
            }
        }, this);
    }

    // TODO: support filter parameter
    private performGetOrCreateObject(action: Action) {
        this.getEntity(action.getOrCreateObjectEntity,
            obj => {
                if (obj != null) {
                    this.updateActionContext(obj);
                    this.performNextAction();
                } else {
                    mx.data.create({
                        entity: action.getOrCreateObjectEntity,
                        callback: object => {
                            this.updateActionContext(object);
                            this.performNextAction();
                        },
                        error: e => {
                            this.onError(action, e);
                            this.reset();
                        }
                    }, this);
                }
            },
            e => {
                this.onError(action, e);
                this.reset();
            }
        );
    }

    private performChangeObject(action: Action) {
        const value = eval(this.replaceVariables(action.newAttributeValue));
        this.actionContextObject.set(action.newAttribute, value);
        this.performNextAction();
    }

    private performOpenPage(action: Action) {
        if (this.actionContextObject) {
            const context = new mendix.lib.MxContext();
            context.setContext(this.actionContextObject.getEntity(), this.actionContextObject.getGuid());
            mx.ui.openForm(action.openPage, {
                location: action.openPageLocation,
                context,
                callback: () => this.performNextAction()
            }, this);
        } else {
            mx.ui.openForm(action.openPage, {
                location: "content",
                callback: () => this.performNextAction()
            }, this);
        }
    }

    private performClosePage() {
        mx.ui.back();
        this.performNextAction();
    }

    private performClosePopup() {
        (this.mxform as any).close(); // TODO: Add close to mendix-client typings
        this.performNextAction();
    }

    private performSync(action: Action) {
        mx.data.synchronizeOffline(
            { fast: action.syncDataOnly },
            () => this.performNextAction(),
            e => {
                this.onError(action, e);
                this.reset();
            }
        );
    }

    private performShowProgress() {
        this.pid = mx.ui.showProgress();
        this.performNextAction();
    }

    private performHideProgress() {
        if (this.pid) {
            mx.ui.hideProgress(this.pid);
        }
        this.performNextAction();
    }

    private performCustom(action: Action) {
        // TODO: support Promises
        try {
            eval(this.replaceVariables(action.customAction));
            this.performNextAction();
        } catch (e) {
            this.onError(action, e);
            this.reset();
        }
    }
}

// Declare widget prototype the Dojo way
// Thanks to https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/dojo/README.md
// tslint:disable : only-arrow-functions
dojoDeclare("OfflineActions.widget.OfflineActions", [ WidgetBase ], function(Source: any) {
    const result: any = {};
    for (const property in Source.prototype) {
        if (property !== "constructor" && Source.prototype.hasOwnProperty(property)) {
            result[property] = Source.prototype[property];
        }
    }
    return result;
}(OfflineActions));
