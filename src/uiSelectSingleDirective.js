uis.directive('uiSelectSingle', ['$timeout','$compile', function($timeout, $compile) {
  return {
    restrict: 'EA',
    require: ['^uiSelect', '^ngModel'],
    link: function(scope, element, attrs, ctrls) {

      var $select = ctrls[0];
      var ngModel = ctrls[1];

      //From view --> model
      ngModel.$parsers.unshift(function (inputValue) {
        // Keep original value for undefined and null
        if (isNil(inputValue)) {
          return inputValue;
        }

        var locals = {},
            result;
        locals[$select.parserResult.itemName] = inputValue;
        result = $select.parserResult.modelMapper(scope, locals);
        return result;
      });

      //From model --> view
      ngModel.$formatters.unshift(function (inputValue) {
        $select.nextResolved = false; // resolved for the next $render call
        setTimeout(function(){
          $select.nextResolved = undefined;
        });
        // Keep original value for undefined and null
        if (isNil(inputValue)) {
          return inputValue;
        }

        var data = $select.parserResult && $select.parserResult.source (scope, { $select : {search:''}}), //Overwrite $search
            locals = {};
        // compute the keys of an item, to match against the value
        var keyOfItem = function(item){
          locals[$select.parserResult.itemName] = item;
          return {
            item: item,
            model: $select.parserResult.modelMapper(scope, locals),
            trackBy: $select.parserResult.trackByMapper && $select.parserResult.trackByMapper(scope, locals),
          };
        };
        // compare the keys of the value and the item
        var valueMatchItem = function(value, item){
          // check the following cases:
          // * value is equals to item (formatted as a choice)
          // * value is equals to item (formatted as a model)
          // * the "track by" ids of value (formatted as a choice) and item are the same
          // * the "track by" ids of value (formatted as a model) and item are the same
          if(angular.equals(value.model, item.model) || angular.equals(value.model, item.item)) return true;
          if($select.parserResult.trackByMapper){
            if(value.trackBy === item.trackBy) return true;
            if($select.parserResult.modelToTrackByMapper){
              if(value.modelTotrackBy === item.trackBy) return true;
            }
          }
          return false;
        };
        locals[$select.parserResult.itemName] = inputValue;
        // the keys of the value, to match against the items
        var value = {
          model: inputValue,
          trackBy: $select.parserResult.trackByMapper && $select.parserResult.trackByMapper(scope, locals),
          modelTotrackBy: $select.parserResult.modelToTrackByMapper && $select.parserResult.modelToTrackByMapper(scope, locals),
        };
        //If possible pass same object stored in $select.selected
        if($select.selected && $select.resolved && valueMatchItem(value, keyOfItem($select.selected))){
          $select.nextResolved = true;
          return $select.selected;
        }
        //Check model array of all items available
        if(data){
          for(var i = data.length - 1; i >= 0; i--){
            if(valueMatchItem(value, keyOfItem(data[i]))){
              $select.nextResolved = true;
              return data[i];
            }
          }
        }
        return inputValue;
      });

      //Update viewValue if model change
      scope.$watch('$select.selected', function(newValue) {
        if (ngModel.$viewValue !== newValue) {
          ngModel.$setViewValue(newValue);
        }
      });

      ngModel.$render = function() {
        $select.selected = ngModel.$viewValue;
        $select.resolved = $select.nextResolved || false;
        $select.nextResolved = undefined;
      };

      scope.$on('uis:select', function (event, item) {
        $select.selected = item;
        $select.resolved = true;
        var locals = {};
        locals[$select.parserResult.itemName] = item;

        $timeout(function() {
          $select.onSelectCallback(scope, {
            $item: item,
            $model: isNil(item) ? item : $select.parserResult.modelMapper(scope, locals)
          });
        });
      });

      scope.$on('uis:close', function (event, skipFocusser) {
        $timeout(function(){
          $select.focusser.prop('disabled', false);
          if (!skipFocusser) $select.focusser[0].focus();
        },0,false);
      });

      scope.$on('uis:activate', function () {
        focusser.prop('disabled', true); //Will reactivate it on .close()
      });

      //Idea from: https://github.com/ivaynberg/select2/blob/79b5bf6db918d7560bdd959109b7bcfb47edaf43/select2.js#L1954
      var focusser = angular.element("<input ng-disabled='$select.disabled' class='ui-select-focusser ui-select-offscreen' type='text' id='{{ $select.focusserId }}' aria-label='{{ $select.focusserTitle }}' aria-haspopup='true' role='button' />");
      $compile(focusser)(scope);
      $select.focusser = focusser;

      //Input that will handle focus
      $select.focusInput = focusser;

      element.parent().append(focusser);
      focusser.bind("focus", function(){
        scope.$evalAsync(function(){
          $select.focus = true;
        });
      });
      focusser.bind("blur", function(){
        scope.$evalAsync(function(){
          $select.focus = false;
        });
      });
      focusser.bind("keydown", function(e){

        if (e.which === KEY.BACKSPACE && $select.backspaceReset !== false) {
          e.preventDefault();
          e.stopPropagation();
          $select.select(undefined);
          scope.$apply();
          return;
        }

        if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC) {
          return;
        }

        if (e.which == KEY.DOWN  || e.which == KEY.UP || e.which == KEY.ENTER || e.which == KEY.SPACE){
          e.preventDefault();
          e.stopPropagation();
          $select.activate();
        }

        scope.$digest();
      });

      focusser.bind("keyup input", function(e){

        if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC || e.which == KEY.ENTER || e.which === KEY.BACKSPACE) {
          return;
        }

        $select.activate(focusser.val()); //User pressed some regular key, so we pass it to the search input
        focusser.val('');
        scope.$digest();

      });


    }
  };
}]);
