// tslint:disable no-console no-eval TODO: Remove this line pre-release
import * as dojoDeclare from "dojo/_base/declare";
import * as domConstruct from "dojo/dom-construct";
import * as WidgetBase from "mxui/widget/_WidgetBase";
import { Action, Actions } from "./Actions";

class OfflineActions extends WidgetBase {
    // Properties from the Mendix modeler
    trigger: "onClick" | "onLoad" | "onChange";
    elementName: string;
    onChangeAttribute: string;
    actions: Action[];
    // Properties from WidgetBase that are undocumented
    friendlyId: string;

    private contextObject?: mendix.lib.MxObject;
    private currentActionIndex: number;
    private currentAttributeValue: string | number | boolean;
    private onChangeSubscription: number;
    private processId: number;
    private actionHandler: Actions;

    postCreate() {
        this.currentActionIndex = -1;
        this.executeNextAction = this.executeNextAction.bind(this);
        this.onActionError = this.onActionError.bind(this);
        this.actionHandler = new Actions();
        this.actionHandler
            .setMxForm(this.mxform)
            .setSuccessCallback(this.executeNextAction)
            .setErrorCallback(this.onActionError);
        this.setupTrigger();
    }

    update(contextObject: mendix.lib.MxObject, callback?: () => void) {
        this.contextObject = contextObject;
        this.actionHandler.setContextObject(contextObject).setActionObject(contextObject);

        if (this.trigger === "onChange") {
            this.attachOnChange();
        }
        if (callback) {
            callback();
        }
    }

    private setupTrigger() {
        if (this.trigger === "onClick") {
            this.setElementEventHandler();
        } else if (this.trigger === "onLoad") {
            this.executeActions();
        }
    }

    private setElementEventHandler() {
        const element = document.getElementsByClassName("mx-name-" + this.elementName.trim())[0];
        if (!element) {
            this.renderAlert(`Found no element with the name ${this.elementName}`);
        } else {
            element.addEventListener("click", this.executeActions.bind(this));
        }
    }

    private attachOnChange() {
        if (this.onChangeSubscription) {
            this.unsubscribe(this.onChangeSubscription);
        }
        if (this.contextObject) {
            this.onChangeSubscription = this.subscribe({
                guid: this.contextObject.getGuid(),
                attr: this.onChangeAttribute,
                callback: guid => {
                    mx.data.get({
                        guid,
                        callback: obj => {
                            this.currentAttributeValue = obj.get(this.onChangeAttribute);
                            this.executeActions();
                        }
                    }, this);
                }
            });
        } else {
            this.renderAlert("the widget requires a context when set to trigger on attribute change");
        }
    }

    private renderAlert(message: string) {
        const alert = domConstruct.create("div", { class: "alert alert-danger" }, this.domNode);
        alert.innerHTML = `Configuration error in widget ${this.friendlyId}: ${message}`;
    }

    private executeActions() {
        this.reset();
        this.executeNextAction();
    }

    private reset() {
        this.currentActionIndex = -1;
    }

    private executeNextAction() {
        this.currentActionIndex++;
        if (this.currentActionIndex === this.actions.length) {

            return;
        }
        const action = this.actions[this.currentActionIndex];
        if (action.precondition.trim()) {
            try {
                const result = eval(this.replaceVariables(action.precondition));
                if (!result) {
                    this.executeNextAction();

                    return;
                }
            } catch (error) {
                this.onActionError(error, `failed to evaluate precondition: ${action.precondition}`);
                this.reset();

                return;
            }
        }

        if (action.actionType === "savePage") {
            this.actionHandler.savePage(action.syncOnSavePage);
        } else if (action.actionType === "openPage") {
            this.actionHandler.openPage(action);
        } else if (action.actionType === "commitObject") {
            this.actionHandler.commitObject(action);
        } else if (action.actionType === "createObject") {
            this.actionHandler.createObject(action.newObjectEntity);
        } else if (action.actionType === "getOrCreateObject") {
            this.actionHandler.getOrCreateObject(action);
        } else if (action.actionType === "changeObject") {
            this.actionHandler.changeObject(action.newAttribute, this.replaceVariables(action.newAttributeValue));
        } else if (action.actionType === "closePage") {
            this.actionHandler.closePage();
        } else if (action.actionType === "closePopup") {
            this.actionHandler.closePopup();
        } else if (action.actionType === "sync") {
            this.actionHandler.sync(action.syncDataOnly);
        } else if (action.actionType === "showProgress") {
            this.actionHandler.showProgress();
        } else if (action.actionType === "hideProgress") {
            this.actionHandler.hideProgress();
        } else if (action.actionType === "custom") {
            this.actionHandler.custom(this.replaceVariables(action.customAction));
        } else {
            mx.ui.error("Unknown action: " + action.actionType);
        }
    }

    private replaceVariables(code: string) {
        if (this.contextObject) {
            // TODO: add metaData to mendix.lib.MxObject typings
            const attributes = (this.contextObject as any).metaData.getAttributesWithoutReferences();
            for (const attribute of attributes) {
                code = code.replace(new RegExp("\\$" + attribute, "g"), "" + this.contextObject.get(attribute));
            }
        }
        if (this.currentAttributeValue) {
            code = code.replace(new RegExp("\\$value", "g"), "" + this.currentAttributeValue);
        }

        return code;
    }

    private onActionError(error: Error, errorMessage?: string) {
        const action = this.actions[this.currentActionIndex];
        if (this.processId) {
            mx.ui.hideProgress(this.processId);
        }
        const message = action.errorMessage || `An error occurred while executing action ${action.actionType}`;
        mx.ui.error(`${message}: ${errorMessage || error.message}`, true);
        this.reset();
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
