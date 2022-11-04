// eslint-disable-next-line no-unused-vars
import { Plugin } from "./Main";
import { IProjectSettings } from "./Interfaces";

export class Tool{
    
    /** callback to show or hide the menu for a selected item or folder
    * 
    * */ 
    showMenu(itemId:string) {
        return !itemId.startsWith("F-");
    }

    /** callback when user executes the custom the menu entry added to items or folders 
     * 
     * */ 
    menuClicked(itemId:string) {
        this.updateRisk(itemId);
    }

    async updateRisk(riskId:string) {


        if (app.needsSave() ) {
            ml.UI.showError("please save before sync","");
            return;
        }

        let projectConfig = <IProjectSettings>IC.getSettingJSON( Plugin.config.projectSettingsPage.settingName, {});
        
        // we know it does exist here (if not the menu would not be enabled in the first place)
        let conf = projectConfig.rules.filter( rule => rule.category == ml.Item.parseRef(riskId).type )[0];

        let riskFieldDef = IC.getFieldByName(ml.Item.parseRef(riskId).type, conf.riskField);
        let riskControlFieldDef = IC.getFieldByName(ml.Item.parseRef(riskId).type, conf.controlField);

        // this should not happen unless something is badly configured
        if (!riskFieldDef || !riskControlFieldDef) return;
        
        let riskFieldId = riskFieldDef.id;
        let riskControlFieldId = riskControlFieldDef.id;
        
        // get the current risk value
        let item = await app.getItemAsync( riskId );
        let riskVal = JSON.parse( item[riskFieldId] );
        let existingLinks = item.downLinks?item.downLinks.map( down => down.to ):[];
        //console.log(riskVal);
        
        // get the risk controls which were last synced into the item and clean them up
        let controlVal = item[riskControlFieldId].replace(/<p>/g,"").replace(/<\/p>/g,"")
        let controls = controlVal?controlVal.split("<br>"):[];
        //console.log(controls);
      
        // get all controls from risk
        let implemented = [];
        let mit = riskVal.mitigations?riskVal.mitigations:[];
        for (let m of mit) {
            for (let c of m.changes?m.changes:[]) {
                if (c[conf.controlDetailsColumnId]) {
                    implemented.push( c[conf.controlDetailsColumnId] );
                }
            }
        }
      
        // see which ones are missing
        let missing = controls.filter( c => implemented.indexOf( c ) == -1);
      
        if (missing == 0) {
            ml.UI.showSuccess( "risk controls are still up-to-date");
            return;
        }
      
        // add the missing risk controls into the todo section

        // check if there's already a todo risk control... if not create it
        let todoControl;
        let todoControls = mit.filter( m => m.to == conf.todoRisk );
        if (todoControls.length == 0) {
           todoControl = { to: conf.todoRisk, changes:[] };
           mit.push( todoControl );
        } else {
           todoControl = todoControls[0];
           //console.log(todoControl);
        }
       
        for( let m of missing) {
           let c = {};
           c[conf.controlDetailsColumnId] = m;
           todoControl.changes.push( c );
        }
      
        // console.log( riskVal);
        await app.setFieldInDBAsync( riskId, conf.riskField, JSON.stringify( riskVal ));
        // create the link to the risk control if needed
        if (existingLinks.indexOf( conf.todoRisk ) == -1) {
            await app.addDownLinkAsync( riskId, conf.todoRisk);
        }
        app.renderItem();
    }
}
