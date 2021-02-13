class DependencyStatusMap {
	constructor() {
		this._deps = new Map();
	}
	
	markInspected( depName ) {
		this._get( depName ).inspected = true;
	}
	
	markChanged( depName ) {
		const dep = this._get( depName );
		dep.inspected = true;
		dep.changed = true;
	}
	
	markUpToDate( depName ) {
		const dep = this._get( depName );
		dep.inspected = true;
		dep.upToDate = true;
	}
	
	isUpToDate( depName ) {
		return this._get( depName ).upToDate;
	}
	
	inspectedCount() {
		let inspected = 0;
		for ( const dep of this._deps.values() ) {
			if ( dep.inspected ) {
				inspected++;
			}
		}
		return inspected;
	}
	
	changedCount() {
		let changed = 0;
		for ( const dep of this._deps.values() ) {
			if ( dep.changed ) {
				changed++;
			}
		}
		return changed;
	}
	
	_get( depName ) {
		if ( !this._deps.has( depName ) ) {
			this._deps.set( depName, {
				inspected: false,
				changed: false,
				upToDate: false
			} );
		}
		return this._deps.get( depName );
	}
}

export default DependencyStatusMap;
