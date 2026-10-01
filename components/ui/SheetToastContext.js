import { createContext } from 'react';

/**
 * The screen's toast, handed down to the sheets it opens.
 *
 * A sheet is a Modal, and a Modal draws above everything the screen draws — including the screen's
 * own Toast. Every "Could not save…", "Could not read that marks sheet" and "Marks saved" shown while
 * a sheet was open therefore appeared BEHIND it, invisible, and a failed action looked like nothing
 * happening at all. ScreenScaffold provides its toast here; FormSheet shows it inside the Modal.
 */
const SheetToastContext = createContext(null);

export default SheetToastContext;
