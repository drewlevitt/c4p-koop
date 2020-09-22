# c4p-koop
This is a deployment of a Koop.js server as part of the [Code for Pittsburgh](https://www.meetup.com/codeforpgh/) [food access map](https://github.com/CodeForPittsburgh/food-access-map-data) project.

The high-level idea is that we have a bunch of food access location data in a CSV with latlongs, and we have an ArcGIS Online web app to display those data, but we can only use critical AGOL features such as filter widgets if we make our data available in a format akin to an AGOL hosted feature layer. Enter [Koop.js](https://koopjs.github.io/): an open-source project from Esri that creates a lightweight web server that ingests geospatial data from a variety of formats and makes it available in a variety of formats, including GeoServices which should meet our needs here. 

I tried [earlier](https://github.com/drewlevitt/koop-test) to deploy a Koop server to Heroku, but was stymied by a mysterious bug that caused the deployed app to crash when the critical `query` route was requested, even though that route worked fine in the `heroku local` environment. In *this* repository, I'm setting up a Koop server and deploying it on Google App Engine, whose [free quota](https://cloud.google.com/appengine/quotas) should be sufficient to let us keep the Koop server up 24/7. We may need to recreate some or all of this work in an official [C4P](https://github.com/CodeForPittsburgh/) repository, but this is a start and maybe we can just fork it into the C4P GitHub account. 

## How I Did It, Vol. 2: *If* I Did It, by O.J. Simpson
We're going to try a different tack, deploying a Koop server to Google App Engine. I've used Google Cloud Compute Engine before but haven't used App Engine. But App Engine seems to be very [Heroku-like](https://stackoverflow.com/questions/22697049/what-is-the-difference-between-google-app-engine-and-google-compute-engine), which is what we want.

App Engine has a [free quota](https://cloud.google.com/appengine/quotas#Instances) of 28 instance-hours per day, and because I don't *think* we'll have more than one instance very often if at all, that should mean it should be effectively permanently free. 

### Install Koop
Per [the Koop quickstart guide](https://koopjs.github.io/docs/basics/quickstart), Koop requires Node.js and `npm` (which is a part of Node.js). So:

1. Install [Node.js](https://nodejs.org/en/). I installed version 12.18.3 LTS but I imagine the 14.10.0 Current version would work fine too.
2. Verify that Node.js installation was successful by opening a terminal and typing `node -v` and/or `npm -v`. This latter command printed `6.14.6` for me.
3. Type `npm install -g @koopjs/cli` to install the Koop CLI. 

### Create the Koop app

1. In the *parent* directory of where you want the app to live (say, `C:\Users\drew\Documents\GitHub`), run `koop new app c4p-koop`. This will create a directory called `c4p-koop` and pre-populate a Git configuration, Node.js dependencies, etc.
2. If you already created a directory/repository, you can run `koop new app` and partially overwrite that repo with the Koop files, but it's cleaner to let Koop CLI create a fresh directory.
3. In the `c4p-koop` directory, you can run `npm start` to start the dev server (a quick server that is available locally for rapid development purposes). You can then visit http://localhost:8080/ to see the dev server in action. (Initially, all it does is display "Welcome to Koop!") You can also run `koop serve` and get the same result (I think).
4. We need the [CSV provider](https://github.com/koopjs/koop-provider-csv), so within the `c4p-koop` directory, run `koop add provider koop-provider-csv`.

### Configure the Koop CSV provider
The basic idea of Koop is that it ingests data from any of several **provider** plugins, intermediately converts the data to GeoJSON, then exports data to any of several **output** plugins. Koop comes with the GeoServices output plugin already installed (because, as far as I can tell, making geospatial data available via the GeoServices API is the primary point of Koop) but we need to install the CSV provider plugin separately.

Helpful documentation [here](https://github.com/koopjs/koop-provider-csv#configuration). 

1. Open `c4p-koop/config/default.json` in a text editor.
2. Define one or more CSV sources, following the format in the documentation.
3. It might be helpful to assign an `idField` in the config file - Koop chirps at me that no `idField` was set, but reassures me that it created an `OBJECTID` field for me instead.

### Receive some feature data!

1. Start the Koop dev server via `koop serve` and/or `npm start` (again, not sure whether there's a distinction).
2. Some trial and error (and some review of the [GeoServices specification](https://www.esri.com/~/media/Files/Pdfs/library/whitepapers/pdfs/geoservices-rest-spec.pdf)) yields the following endpoint as a location where the whole dataset will be returned in JSON format compatible with the GeoServices API: http://localhost:8080/koop-provider-csv/food-data/FeatureServer/0/query
3. However, this combination of Koop provider (CSV) and output (GeoServices) plugins, by default, returns the first 2000 features only. Our dataset has more than 2000 features (we can tell because `exceededTransferLimit` is `true`), so we need to pass a URL parameter overriding this default limit. The [Koop FAQ](https://koopjs.github.io/docs/basics/faqs) sheds some light on this - we can use `resultRecordCount` to get more than 2000 results. We could just pass `resultRecordCount=999999` or some other very large number, but this is inelegant. The FAQ doesn't mention it but a lucky guess reveals that `resultRecordCount=-1` causes the endpoint to return *all* results: http://localhost:8080/koop-provider-csv/food-data/FeatureServer/0/query?resultRecordCount=-1

### Set up Google App Engine
I drew some of these steps from [this tutorial](https://cloud.google.com/appengine/docs/standard/nodejs/building-app).

1. Go to https://console.cloud.google.com/ and create an account if necessary.
2. Create a new project (mine is called `c4p-koop` like this repository is).
3. Enable App Engine for this new project. We have to pick a [region](https://cloud.google.com/about/locations#region) to locate the app; anyone can access the app but latency will be lower for people closer to this region. Because we're in Pittsburgh, we'll use `us-east4`, which is in northern Virginia, conveniently nearby.
4. Install [Cloud SDK](https://cloud.google.com/sdk/docs/quickstart) and run `gcloud init` in a terminal to set up the `gcloud` command to work with this app.

### Prepare the Koop app for App Engine deployment
The below steps are adapted from [this guide](https://cloud.google.com/appengine/docs/standard/nodejs/building-app/writing-web-service).

1. By default, Koop listens on a port defined in `config/default.json`. We need to change this to pull the port from the Node.js `process` global variable, so we edit `src/index.js` to tell the Koop server to listen at `process.env.PORT`. (This step is the same as readying Koop for Heroku deployment.)
2. App Engine uses an `app.yaml` file to specify environment configuration. We create an empty file with this name, then add the line `runtime: nodejs12`.
3. Commit these changes to your repository. I'm not 100% sure this is necessary before App Engine deployment, but it couldn't hurt.

### Deploy to App Engine
[This guide](https://cloud.google.com/appengine/docs/standard/nodejs/building-app/deploying-web-service) was helpful.

1. From the `c4p-koop` directory, run `gcloud app deploy`. This will take a minute or two, but ran successfully on my first attempt.
2. Visit the live deployed app, either by running `gcloud app browse` in the terminal or by copy-pasting the URL shown during deployment. You'll see "Welcome to Koop!"
3. Finally, we can append the route we identified earlier to actually receive features from the App Engine deployment of Koop: https://c4p-koop.uk.r.appspot.com/koop-provider-csv/food-data/FeatureServer/0/query?resultRecordCount=-1 

Notably, this just works, while deploying an identical app to Heroku crashed mysteriously when the critical `query` route was requested. Well done, Google!