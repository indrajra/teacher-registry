import { Component, OnInit, EventEmitter, OnDestroy } from '@angular/core';
import { DataService } from '../../services/data/data.service'
import * as _ from 'lodash-es';
import { ResourceService } from '../../services/resource/resource.service'
import { Router, ActivatedRoute } from '@angular/router'
import { ICard } from '../../services/interfaces/Card';
import { takeUntil, map, first, debounceTime, delay } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import appConfig from '../../services/app.config.json';
import { UserService } from 'src/app/services/user/user.service';
import { CacheService } from 'ng2-cache-service';
import { ToasterService } from 'src/app/services/toaster/toaster.service';

@Component({
  selector: 'app-admin-page',
  templateUrl: './admin-page.component.html',
  styleUrls: ['./admin-page.component.scss']
})
export class AdminPageComponent implements OnInit, OnDestroy {

  dataService: DataService;
  public showLoader = true;
  resourceService: ResourceService;
  router: Router;
  activatedRoute: ActivatedRoute;
  public paginationDetails = {
    totalItems: 0,
    currentOffset: 0,
    intialOffset: 0,
    previousBtn: true,
    nextBtn: false,
    limit: 24,
    offset: 24
  };
  pageLimit: any
  public dataDrivenFilterEvent = new EventEmitter();
  public listOfEmployees: ICard[] = [];
  public initFilters = false;
  public dataDrivenFilters: any = {};
  public queryParams: any;
  public unsubscribe$ = new Subject<void>();
  public key: string;
  public buttonIcon: string = 'list';
  public buttonText: string = 'list view'
  result: { "headers": string; "row": {}; };
  userService: UserService;
  schoolId = ""

  constructor(dataService: DataService, resourceService: ResourceService, route: Router, activatedRoute: ActivatedRoute,
    userService: UserService, public cacheService: CacheService, public toasterService: ToasterService) {
    this.dataService = dataService;
    this.userService = userService;
    this.resourceService = resourceService;
    this.router = route;
    this.activatedRoute = activatedRoute;
    this.pageLimit = appConfig.PAGE_LIMIT
  }

  ngOnInit() {
    this.getUserDetails();
    this.resetPaigination();
    this.result = {
      "headers": '',
      "row": ''
    }
    this.initFilters = true;
    this.dataDrivenFilterEvent.pipe(first()).
      subscribe((filters: any) => {
        this.dataDrivenFilters = filters;
        this.fetchDataOnParamChange();
      });
    this.activatedRoute.queryParams.subscribe(queryParams => {
      this.queryParams = { ...queryParams };
      this.key = this.queryParams['key'];
    });
  }

  getDataForCard(data) {
    const list: Array<ICard> = [];
    _.forEach(data, (item, key) => {
      const card = this.processContent(item);
      list.push(card);
    });
    return <ICard[]>list;

    // FIXME: Put all resigned employees last
    // return <ICard[]>list.sort((a, b) => {
    //   if (a.endDate > b.endDate) {
    //     return 1;
    //   }
    //   return 0;
    // });
  }

  getUserDetails() {
    let userInfo = this.cacheService.get(appConfig.cacheServiceConfig.cacheVariables.EmployeeDetails);
    if(userInfo) {
      this.schoolId = userInfo.schoolId;
    } else {
      let token = this.cacheService.get(appConfig.cacheServiceConfig.cacheVariables.UserToken);
      if (_.isEmpty(token)) {
        token = this.userService.getUserToken;
      }
      const requestData = {
        header: { Authorization: token },
        data: {
          id: appConfig.API_ID.READ,
          request: {
            Teacher: {
              osid: ""
            },
            includeSignatures: true,
          }
        },
        url: appConfig.URLS.READ,
      }
      this.dataService.post(requestData).subscribe(response => {
        if (response.params.status === 'SUCCESSFUL') {
  
        }
      }, (err => {
        console.log(err)
      }))
    }
  }

  processContent(data) {
    const content: any = {
      name: data.name,
      identifier: data.osid,
      teacherType: data.teacherType,
      code:data.code,
      qualification: data.academicQualification
    };
    return content;
  }

  navigateToProfilePage(user: any) {
    this.router.navigate(['/profile', user.data.identifier]);
  }

  changeView() {
    if (this.buttonIcon === 'list') {
      this.buttonIcon = 'block layout';
      this.buttonText = 'grid view'
    } else {
      this.buttonIcon = 'list'
      this.buttonText = 'list view'
    }
  }


  onEnter(key) {
    this.key = key;
    this.queryParams = {};
    this.queryParams['key'] = this.key;
    if (this.key && this.key.length > 0) {
      this.queryParams['key'] = this.key;
    } else {
      delete this.queryParams['key'];
    }
    this.resetPaigination()
    this.router.navigate(["/search"], {
      queryParams: this.queryParams
    });
  }

  resetPaigination() {
    this.paginationDetails.previousBtn = true;
    this.paginationDetails.nextBtn = false;
    this.paginationDetails.currentOffset = 0;
  }

  next(nextOffset) {
    let total = this.paginationDetails.currentOffset + nextOffset;
    this.paginationDetails.previousBtn = false;
    this.paginationDetails.currentOffset = total;
    this.fetchEmployees(total)
  }

  previous() {
    let total = this.paginationDetails.currentOffset - this.paginationDetails.offset;
    if (total >= this.paginationDetails.intialOffset) {
      this.paginationDetails.currentOffset = total;
      this.fetchEmployees(total)
    }
    if (total === this.paginationDetails.intialOffset) {
      this.paginationDetails.previousBtn = true
      this.paginationDetails.nextBtn = false
    }

  }

  public getFilters(filters) {
    const defaultFilters = _.reduce(filters, (collector: any, element) => {
      return collector;
    }, {});
    this.dataDrivenFilterEvent.emit(defaultFilters);
  }

  private fetchDataOnParamChange() {
    combineLatest(this.activatedRoute.params, this.activatedRoute.queryParams)
      .pipe(debounceTime(5), // wait for both params and queryParams event to change
        delay(10),
        map(result => ({ params: { pageNumber: Number(result[0].pageNumber) }, queryParams: result[1] })),
        takeUntil(this.unsubscribe$)
      ).subscribe(({ params, queryParams }) => {
        this.resetPaigination();
        this.showLoader = true;
        this.queryParams = { ...queryParams };
        this.listOfEmployees = [];
        this.fetchEmployees(this.paginationDetails.intialOffset);
      });
  }

  private fetchEmployees(offset) {
    let token = this.cacheService.get(appConfig.cacheServiceConfig.cacheVariables.UserToken);
    if (_.isEmpty(token)) {
      token = this.userService.getUserToken;
    }
    const option = {
      url: appConfig.URLS.SEARCH,
      header: { Authorization: token },
      data: {
        id: appConfig.API_ID.SEARCH,
        request: {
          entityType: ["Teacher"],
          filters: {
          }
        }
      }
    }
    let filters = _.pickBy(this.queryParams, (value: Array<string> | string) => value && value.length);
    filters = _.omit(filters, ['key', 'sort_by', 'sortType', 'appliedFilters']);
    option.data.request.filters = this.getFilterObject(filters);
    option.data.request.filters['schoolId'] = {
      eq: this.schoolId
    }
    if (!this.queryParams.key) {
      option.data.request['offset'] = offset;
      option.data.request['limit'] = this.paginationDetails.limit;
    }
    this.dataService.post(option)
      .subscribe(data => {
        if (data.result.Teacher && data.result.Teacher.length > 0) {
          this.showLoader = false;
          this.listOfEmployees = this.getDataForCard(data.result.Teacher);
          this.result = {
            "headers": _.keys(this.listOfEmployees[0]),
            "row": this.listOfEmployees
          }
          if (data.result.Teacher.length < this.paginationDetails.limit) {
            this.showLoader = false;
            this.paginationDetails.nextBtn = true;
          }
        } else {
          this.result = {
            "headers": '',
            "row": ''
          }
          this.showLoader = false;
          this.paginationDetails.nextBtn = true
        }
      }, err => {
        this.toasterService.error(this.resourceService.frmelmnts.msg.errorMsg);
        this.showLoader = false;
        this.listOfEmployees = [];
      });
  }

  getFilterObject(filter) {
    let option = {}
    if (filter) {
      _.forEach(filter, (elem, key) => {
        let filterType = {}
        if (_.isArray(elem)) {
          filterType['or'] = elem;
        } else {
          filterType['contains'] = elem;
        }
        option[key] = filterType;
      });
    }
    //search by name
    if (this.queryParams.key) {
      let filterTypes = {}
      filterTypes["startsWith"] = this.queryParams.key;
      option["name"] = filterTypes
    }
    return option;
  }

  clearQuery() {
    let redirectUrl = this.router.url.split('?')[0];
    redirectUrl = decodeURI(redirectUrl);
    this.router.navigate([redirectUrl]);
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
