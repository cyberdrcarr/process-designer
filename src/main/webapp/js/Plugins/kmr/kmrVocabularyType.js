if (!ORYX.Plugins) 
    ORYX.Plugins = new Object();


   //========================= DATASTORE ====================================
 
    var lookupRecord = Ext.data.Record.create([{name: 'id', type:'int'},
                                               {name: 'name'},
                                               {name: 'descr'} ]);
    var lookupJSONReader = new Ext.data.JsonReader({totalProperty: 'totalrecsfound',
                                                    root: 'refdata'
                                                   }, lookupRecord);
    var ds_vocabulary = new Ext.data.Store({
         proxy: new Ext.data.HttpProxy({
             url: ORYX.CONFIG.KMR_VOCABULARY_SERVICE_URL,
             method:'GET'
         }),
        autoLoad: false,
        reader: lookupJSONReader
    });
			   
    
    //========================= DATASTORE ====================================
    var cleards = function() {
	
        if (ds_vocabulary){
            ds_vocabulary.removeAll();
        }
    };    
    

ORYX.Plugins.KmrVocabularyType = Clazz.extend({
    facade: undefined,
    
    construct: function(facade){
        this.facade = facade;
        ORYX.FieldEditors["kmrsinglevocabulary"] = new ORYX.Plugins.KmrVocabularyType.EditorFactory();
        ORYX.FieldEditors["kmrmultivocabulary"] = new ORYX.Plugins.KmrVocabularyType.MultiValueEditorFactory();
    }

});

ORYX.Plugins.KmrVocabularyType.EditorFactory = Clazz.extend({
    construct: function(){
        
    },          
    /**
     * This function gets executed by propertyWindow in its own context,
     * so this = propertyWindow
     */
    init: function(){
        //arguments: key, pair, icons, index
        var key = arguments[0];
        var pair = arguments[1];
        var index = arguments[3];
        
        //we only need the combo-box
        
        var cf = new Ext.form.KmrVocabularyTypeField({allowBlank: pair.optional()}, pair.complexItems(), key, this.facade).getKmrDropDown(pair._jsonProp.lookupType);
        
        return new Ext.Editor(cf);
    }
});

ORYX.Plugins.KmrVocabularyType.MultiValueEditorFactory = Clazz.extend({
    construct: function(){
        
    },          
    /**
     * This function gets executed by propertyWindow in its own context,
     * so this = propertyWindow
     */
    init: function(){
        //arguments: key, pair, icons, index
        var key = arguments[0];
        var pair = arguments[1];
        var index = arguments[3];
        
        var cf = new Ext.form.KmrVocabularyTypeField({allowBlank: pair.optional()}, pair.complexItems(), key, this.facade);
        cf.on('dialogClosed', this.dialogClosed, {scope:this, row:index, col:1,field:cf});	
        
        return new Ext.Editor(cf);
    }
});

Ext.form.KmrVocabularyTypeField = function(config, items, key, facade){
    Ext.form.KmrVocabularyTypeField.superclass.constructor.call(this, config);
	this.items 	= items;
	this.key 	= key;
	this.facade = facade;
};

/**
 * This is a special trigger field used for complex properties.
 * The trigger field opens a dialog that shows a list of properties.
 * The entered values will be stored as trigger field value in the JSON format.
 */
Ext.extend(Ext.form.KmrVocabularyTypeField, Ext.form.TriggerField,  {
	/**
     * @cfg {String} triggerClass
     * An additional CSS class used to style the trigger button.  The trigger will always get the
     * class 'x-form-trigger' and triggerClass will be <b>appended</b> if specified.
     */
    triggerClass:	'x-form-complex-trigger',
	readOnly:		true,
	emptyText: 		ORYX.I18N.PropertyWindow.clickIcon,
 		
	/**
	 * Builds the JSON value from the data source of the grid in the dialog.
	 */
	buildValue: function() {
		var ds = this.grid.getStore();
		ds.commitChanges();
		
		if (ds.getCount() == 0) {
			return "";
		}
		
		var jsonString = "[";
		for (var i = 0; i < ds.getCount(); i++) {
			var data = ds.getAt(i);		

			jsonString += "{";	
			for (var j = 0; j < this.items.length; j++) {
				var key = this.items[j].id();
				jsonString += key + ':' + ("" + data.get(key)).toJSON();
				if (j < (this.items.length - 1)) {
					jsonString += ", ";
				}
			}
			jsonString += "}";
			if (i < (ds.getCount() - 1)) {
				jsonString += ", ";
			}
		}
		jsonString += "]";
		
		jsonString = "{'totalCount':" + ds.getCount().toJSON() +
			", 'items':" + jsonString + "}";
		return Object.toJSON(jsonString.evalJSON());
	},
	
	/**
	 * Returns the field key.
	 */
	getFieldKey: function() {
		return this.key;
	},
	
	/**
	 * Returns the actual value of the trigger field.
	 * If the table does not contain any values the empty
	 * string will be returned.
	 */
    getValue : function(){
		// return actual value if grid is active
		if (this.grid) {
			return this.buildValue();			
		} else if (this.data == undefined) {
			return "";
		} else {
			return this.data;
		}
    },
	
	/**
	 * Sets the value of the trigger field.
	 * In this case this sets the data that will be shown in
	 * the grid of the dialog.
	 * 
	 * @param {Object} value The value to be set (JSON format or empty string)
	 */
	setValue: function(value) {	
		if (value.length > 0) {
			// set only if this.data not set yet
			// only to initialize the grid
			if (this.data == undefined) {
				this.data = value;
			}
		}
	},
	
	/**
	 * Returns false. In this way key events will not be propagated
	 * to other elements.
	 * 
	 * @param {Object} event The keydown event.
	 */
	keydownHandler: function(event) {
		return false;
	},
	
	/**
	 * The listeners of the dialog. 
	 * 
	 * If the dialog is hidded, a dialogClosed event will be fired.
	 * This has to be used by the parent element of the trigger field
	 * to reenable the trigger field (focus gets lost when entering values
	 * in the dialog).
	 */
    dialogListeners : {
        show : function(){ // retain focus styling
            this.onFocus();	
			this.facade.registerOnEvent(ORYX.CONFIG.EVENT_KEYDOWN, this.keydownHandler.bind(this));
			this.facade.disableEvent(ORYX.CONFIG.EVENT_KEYDOWN);
			return;
        },
        hide : function(){

            var dl = this.dialogListeners;
            this.dialog.un("show", dl.show,  this);
            this.dialog.un("hide", dl.hide,  this);
			
            this.dialog.destroy(true);
            this.grid.destroy(true);
            delete this.grid;
            delete this.dialog;

            this.facade.unregisterOnEvent(ORYX.CONFIG.EVENT_KEYDOWN, this.keydownHandler.bind(this));
            this.facade.enableEvent(ORYX.CONFIG.EVENT_KEYDOWN);

            // store data and notify parent about the closed dialog
            // parent has to handel this event and start editing the text field again
            this.fireEvent('dialogClosed', this.data);

            Ext.form.ComplexListField.superclass.setValue.call(this, this.data);
        }
    },	
	
	/**
	 * Builds up the initial values of the grid.
	 * 
	 * @param {Object} recordType The record type of the grid.
	 * @param {Object} items      The initial items of the grid (columns)
	 */
	buildInitial: function(recordType, items) {
		var initial = new Hash();
		
		for (var i = 0; i < items.length; i++) {
			var id = items[i].id();
			initial[id] = items[i].value();
		}		
		var RecordTemplate = Ext.data.Record.create(recordType);
		return new RecordTemplate(initial);
	},
    
	
			
	/**
	 * 
	 * @param {Object} id == the complexItems.id element fron bpmn2.0.json
	 */
	getKmrDropDown: function(lookupType) {
			
		var retcombo;
                
                ds_vocabulary.baseParams = {
                    "reference": "factcode",
                    "lookuptype": lookupType,
                    "MaxRecordsToShow": "200"
                }; 
                
                ds_vocabulary.load();
                
                retcombo = new Ext.form.ComboBox({
	   	         fieldLabel : 'Kmr Code'
	            ,autoSelect : false
	            ,forceSelection : true
	            ,allowBlank  : true // allows delete of value field give orig list.
	            //,id         : comboId
	            //,pageSize: 20
	            //-------- store --------
	            ,hiddenName    : 'KmrCode' //used for Search. 
	            ,displayField  : 'name'      //used for Ref (name)
	            ,valueField    : 'descr' //'descr'  //this value gets displayed on grid
	            ,triggerAction : 'all'
	            ,mode          : 'remote'
	            ,minchars      : 2
	            ,loadingText   : 'loading...'
	            ,store         : ds_vocabulary
	            ,lastQuery     : ''
	            ,tpl           : '<tpl for="."><p class="x-combo-list-item">{name}</p></tpl>' 
	            ,typeAhead     : true
	            ,selectOnFocus : true      
	       });   
		
	    return retcombo;
        
	},
	
	/**
	 * Builds up the column model of the grid. The parent element of the
	 * grid.
	 * 
	 * Sets up the editors for the grid columns depending on the 
	 * type of the items.
	 * 
	 * @param {Object} parent The 
	 */
	buildColumnModel: function(parent) {
		var cols = [];
		for (var i = 0; i < this.items.length; i++) {
			var id 		= this.items[i].id();
			var header 	= this.items[i].name();
			var width 	= this.items[i].width();
			var type 	= this.items[i].type();
			
			var value    = this.items[i].value(); //TMN
			var lookupType = this.items[i]._jsonItem.lookupType; //TMN
			
			var display_field;
			
			var editor;
			
			if (type == ORYX.CONFIG.TYPE_STRING) {
				editor = new Ext.form.TextField({ allowBlank : this.items[i].optional(), width : width});
			
			} else if (type == ORYX.CONFIG.TYPE_CHOICE) {

                //determine if processing KMR properties types	
				if (lookupType) { 		
				    //getting different data store if processing Kmr Properties.		
				    editor = this.getKmrDropDown(lookupType);	
									
				} else {
					var items = this.items[i].items();
					var select = ORYX.Editor.graft("http://www.w3.org/1999/xhtml", parent, ['select', {
						style: 'display:none'
					}]);
					var optionTmpl = new Ext.Template('<option value="{value}">{value}</option>');
					items.each(function(value){
						optionTmpl.append(select, {
							value: value.value()
						});
					});
					
					editor = new Ext.form.ComboBox({
						typeAhead: true,
						triggerAction: 'all',
						transform: select,
						lazyRender: true,
						msgTarget: 'title',
						width: width,
						displayField: id
					});					
					
				}			
			} else if (type == ORYX.CONFIG.TYPE_BOOLEAN) {
				editor = new Ext.form.Checkbox( { width : width } );
			}
					
			cols.push({
				id: 		id,
				header: 	header,
				dataIndex:  id,
				resizable: 	true,
				editor: 	editor,
				width:		width
	        });
			
		}
		return new Ext.grid.ColumnModel(cols);
	},
	
	/**
	 * After a cell was edited the changes will be commited.
	 * 
	 * @param {Object} option The option that was edited.
	 */
	afterEdit: function(option) {
		option.grid.getStore().commitChanges();
	},
		
	/**
	 * Before a cell is edited it has to be checked if this 
	 * cell is disabled by another cell value. If so, the cell editor will
	 * be disabled.
	 * 
	 * @param {Object} option The option to be edited.
	 */
	beforeEdit: function(option) {

		var state = this.grid.getView().getScrollState();
		
		var col = option.column;
		var row = option.row;
		var editId = this.grid.getColumnModel().config[col].id;
		// check if there is an item in the row, that disables this cell
		for (var i = 0; i < this.items.length; i++) {
			// check each item that defines a "disable" property
			var item = this.items[i];
			var disables = item.disable();
			if (disables != undefined) {
				
				// check if the value of the column of this item in this row is equal to a disabling value
				var value = this.grid.getStore().getAt(row).get(item.id());
				for (var j = 0; j < disables.length; j++) {
					var disable = disables[j];
					if (disable.value == value) {
						
						for (var k = 0; k < disable.items.length; k++) {
							// check if this value disables the cell to select 
							// (id is equals to the id of the column to edit)
							var disItem = disable.items[k];
							if (disItem == editId) {
								this.grid.getColumnModel().getCellEditor(col, row).disable();
								return;
							}
						}
					}
				}		
			}
		}
		this.grid.getColumnModel().getCellEditor(col, row).enable();
		//this.grid.getView().restoreScroll(state);
	},

    
			
    /**
     * If the trigger was clicked a dialog has to be opened
     * to enter the values for the complex property.
     */
    onTriggerClick : function(){
		
		
        if(this.disabled){
            return;
        }	
												   		
		//if(!this.dialog) { 
		
			var dialogWidth = 0;
			var recordType 	= [];
			
			for (var i = 0; i < this.items.length; i++) {
				var id 		= this.items[i].id();
				var width 	= this.items[i].width();
				var type 	= this.items[i].type();					
                var value    = this.items[i].value(); //TMN
					
				if (type == ORYX.CONFIG.TYPE_CHOICE) {
					type = ORYX.CONFIG.TYPE_STRING;
				}
						
				dialogWidth += width;
				recordType[i] = {name:id, type:type};
			}			
			
			if (dialogWidth > 800) {
				dialogWidth = 800;
			}
			dialogWidth += 22;
			
			var data = this.data;
			if (data == "") {
				// empty string can not be parsed
				data = "{}";
			}

		    var ds = new Ext.data.Store({
		        proxy: new Ext.data.MemoryProxy(eval("(" + data + ")")),                
		        reader: new Ext.data.JsonReader({
		            root: 'items',
		            totalProperty: 'totalCount'
		            }, recordType)
		    });
		    ds.load();
        					
			var cm = this.buildColumnModel();
			
			this.grid = new Ext.grid.EditorGridPanel({
				store:		ds,
		        cm:			cm,
				stripeRows: true,
				clicksToEdit : 1,
				autoHeight:true,
		        selModel: 	new Ext.grid.CellSelectionModel()

		    });
									
			//var gridHead = this.grid.getView().getHeaderPanel(true);
			var toolbar = new Ext.Toolbar(
			[{
				text: ORYX.I18N.PropertyWindow.add,
				handler: function(){
					var ds = this.grid.getStore();
					var index = ds.getCount();
					this.grid.stopEditing();
					var p = this.buildInitial(recordType, this.items);
					ds.insert(index, p);
					ds.commitChanges();				
					
					cleards();
						
					this.grid.startEditing(index, 0);
				}.bind(this)
			},{
				text: ORYX.I18N.PropertyWindow.rem,
		        handler : function(){
					var ds = this.grid.getStore();
					var selection = this.grid.getSelectionModel().getSelectedCell();
					if (selection == undefined) {
						return;
					}
					this.grid.getSelectionModel().clearSelections();
		            this.grid.stopEditing();					
					var record = ds.getAt(selection[0]);
					ds.remove(record);
					ds.commitChanges();           
				}.bind(this)
			}]);			
		
			// Basic Dialog
			this.dialog = new Ext.Window({ 
				autoScroll: true,
				autoCreate: true, 
				title: ORYX.I18N.PropertyWindow.complex, 
				height: 200, 
				width: dialogWidth, 
				modal:true,
				collapsible:false,
				fixedcenter: true, 
				shadow:true, 
				proxyDrag: true,
				keys:[{
					key: 27,
					fn: function(){
						cleards();						
						this.dialog.hide
					}.bind(this)
				}],
				items:[toolbar, this.grid],
				bodyStyle:"background-color:#FFFFFF",
				buttons: [{
	                text: ORYX.I18N.PropertyWindow.ok,
	                handler: function(){
	                    this.grid.stopEditing();	
						// store dialog input
						this.data = this.buildValue();
						
						cleards();
										
												
						this.dialog.hide()
	                }.bind(this)
	            }, {
	                text: ORYX.I18N.PropertyWindow.cancel,
	                handler: function(){		
					    cleards();
	                	this.dialog.hide()
	                }.bind(this)
	            }]
			});		


				
			this.dialog.on(Ext.apply({}, this.dialogListeners, {
	       		scope:this
	        }));
		
			this.dialog.show();	
		
	
			this.grid.on('beforeedit', 	this.beforeEdit, 	this, true);
			this.grid.on('afteredit', 	this.afterEdit, 	this, true);
			
			this.grid.render();			
	    
		/*} else {
			this.dialog.show();		
		}*/
		
	}
});